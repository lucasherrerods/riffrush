use async_trait::async_trait;
use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::dominio::{cabe_mais_um, inicio_da_janela, ChartGuardado, Rejulgada};
use super::portas::{CacheDeCharts, FilaDoRejulgamento, LimiteDePedidos, PartidaAntiga, PartidaPendente, PartidasAntigas};
use crate::modules::conta::{FalhaExterna, FilaDePartidas, PartidaNaFila};
use crate::modules::progresso::{Dificuldade, Instrumento};

/// Quanto tempo uma partida reservada fica fora da vez. Cobre com folga o download de um .sng.
const RESERVA: Duration = Duration::minutes(10);

pub struct RejulgamentoPostgres(pub PgPool);

fn falha(erro: sqlx::Error) -> FalhaExterna {
    FalhaExterna(format!("banco: {erro}"))
}

#[derive(sqlx::FromRow)]
struct LinhaPendente {
    id: Uuid,
    conta_id: Uuid,
    md5: String,
    dificuldade: String,
    instrumento: String,
    replay: Vec<u8>,
    enviada_em: DateTime<Utc>,
    tentativas: i32,
    rodada_id: Option<Uuid>,
}

impl LinhaPendente {
    /// Texto que o banco não conhece vira None: a linha sai da vez sem travar a fila.
    fn em_partida(self) -> Option<PartidaPendente> {
        Some(PartidaPendente {
            id: self.id,
            conta_id: self.conta_id,
            md5: self.md5,
            dificuldade: Dificuldade::do_texto(&self.dificuldade)?,
            instrumento: Instrumento::do_texto(&self.instrumento)?,
            replay: self.replay,
            enviada_em: self.enviada_em,
            tentativas: u32::try_from(self.tentativas).unwrap_or(0),
            rodada: self.rodada_id,
        })
    }
}

#[async_trait]
impl FilaDePartidas for RejulgamentoPostgres {
    async fn enfileirar(&self, partida: PartidaNaFila) -> Result<(), FalhaExterna> {
        sqlx::query(
            "INSERT INTO partidas_pendentes (id, conta_id, md5, dificuldade, instrumento, replay, enviada_em, tentar_em, rodada_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)",
        )
        .bind(partida.id)
        .bind(partida.conta_id)
        .bind(&partida.md5)
        .bind(partida.dificuldade.como_texto())
        .bind(partida.instrumento.como_texto())
        .bind(&partida.replay)
        .bind(partida.enviada_em)
        .bind(partida.rodada)
        .execute(&self.0)
        .await
        .map(|_| ())
        .map_err(falha)
    }
}

#[derive(sqlx::FromRow)]
struct LinhaAntiga {
    id: Uuid,
    md5: String,
    dificuldade: String,
    instrumento: String,
    replay: Vec<u8>,
}

#[async_trait]
impl PartidasAntigas for RejulgamentoPostgres {
    async fn pegar_antigas(&self, limite: u32) -> Result<Vec<PartidaAntiga>, FalhaExterna> {
        let linhas = sqlx::query_as::<_, LinhaAntiga>(
            "SELECT id, substring(musica_id FROM 8) AS md5, dificuldade, instrumento, replay FROM partidas
             WHERE regras IS NULL AND replay IS NOT NULL AND musica_id LIKE 'encore:%'
             ORDER BY jogada_em LIMIT $1",
        )
        .bind(i64::from(limite))
        .fetch_all(&self.0)
        .await
        .map_err(falha)?;
        let mut partidas = Vec::with_capacity(linhas.len());
        for linha in linhas {
            match (Dificuldade::do_texto(&linha.dificuldade), Instrumento::do_texto(&linha.instrumento)) {
                (Some(dificuldade), Some(instrumento)) => partidas.push(PartidaAntiga {
                    id: linha.id,
                    md5: linha.md5,
                    dificuldade,
                    instrumento,
                    replay: linha.replay,
                }),
                _ => self.sem_como_rejulgar(linha.id).await?,
            }
        }
        Ok(partidas)
    }

    async fn atualizar(&self, id: Uuid, rejulgada: &Rejulgada) -> Result<(), FalhaExterna> {
        let resumo = &rejulgada.resumo;
        let vale_ranking = !resumo.derrota && !resumo.fantasma && !rejulgada.sem_falha;
        sqlx::query(
            "UPDATE partidas SET pontos = $2, acertos = $3, total = $4, derrota = $5, fantasma = $6, maior_sequencia = $7,
                    valor_dos_acertos = $8, precisao = $9, velocidade = $10, jeito_de_jogar = $11, regras = 2,
                    replay = CASE WHEN $9::DOUBLE PRECISION IS NULL THEN NULL ELSE replay END
             WHERE id = $1",
        )
        .bind(id)
        .bind(i64::try_from(rejulgada.pontos).unwrap_or(i64::MAX))
        .bind(i32::try_from(resumo.acertos).unwrap_or(i32::MAX))
        .bind(i32::try_from(resumo.total).unwrap_or(i32::MAX))
        .bind(resumo.derrota)
        .bind(resumo.fantasma)
        .bind(resumo.maior_sequencia.map(|s| i32::try_from(s).unwrap_or(i32::MAX)))
        .bind(resumo.valor_dos_acertos.map(|v| i32::try_from(v).unwrap_or(i32::MAX)))
        .bind(vale_ranking.then_some(rejulgada.precisao))
        .bind(rejulgada.velocidade)
        .bind(rejulgada.jeito_de_jogar.como_texto())
        .execute(&self.0)
        .await
        .map(|_| ())
        .map_err(falha)
    }

    async fn sem_como_rejulgar(&self, id: Uuid) -> Result<(), FalhaExterna> {
        sqlx::query("UPDATE partidas SET regras = 1 WHERE id = $1")
            .bind(id)
            .execute(&self.0)
            .await
            .map(|_| ())
            .map_err(falha)
    }
}

#[async_trait]
impl FilaDoRejulgamento for RejulgamentoPostgres {
    async fn pegar(&self, limite: u32, agora: DateTime<Utc>) -> Result<Vec<PartidaPendente>, FalhaExterna> {
        // SKIP LOCKED: duas instâncias da API nunca pegam a mesma partida.
        let linhas = sqlx::query_as::<_, LinhaPendente>(
            "UPDATE partidas_pendentes SET tentar_em = $2, tentativas = tentativas + 1
             WHERE id IN (SELECT id FROM partidas_pendentes
                          WHERE desistiu_por IS NULL AND tentar_em <= $1
                          ORDER BY enviada_em LIMIT $3 FOR UPDATE SKIP LOCKED)
             RETURNING id, conta_id, md5, dificuldade, instrumento, replay, enviada_em, tentativas, rodada_id",
        )
        .bind(agora)
        .bind(agora + RESERVA)
        .bind(i64::from(limite))
        .fetch_all(&self.0)
        .await
        .map_err(falha)?;
        let mut partidas = Vec::with_capacity(linhas.len());
        for linha in linhas {
            let id = linha.id;
            match linha.em_partida() {
                Some(partida) => partidas.push(partida),
                None => self.desistir(id, "dificuldade ou instrumento desconhecido").await?,
            }
        }
        partidas.sort_by_key(|p| p.enviada_em);
        Ok(partidas)
    }

    async fn concluir(&self, id: Uuid) -> Result<(), FalhaExterna> {
        sqlx::query("DELETE FROM partidas_pendentes WHERE id = $1")
            .bind(id)
            .execute(&self.0)
            .await
            .map(|_| ())
            .map_err(falha)
    }

    async fn reagendar(&self, id: Uuid, quando: DateTime<Utc>) -> Result<(), FalhaExterna> {
        sqlx::query("UPDATE partidas_pendentes SET tentar_em = $2 WHERE id = $1")
            .bind(id)
            .bind(quando)
            .execute(&self.0)
            .await
            .map(|_| ())
            .map_err(falha)
    }

    async fn desistir(&self, id: Uuid, motivo: &str) -> Result<(), FalhaExterna> {
        sqlx::query("UPDATE partidas_pendentes SET desistiu_por = $2 WHERE id = $1")
            .bind(id)
            .bind(motivo)
            .execute(&self.0)
            .await
            .map(|_| ())
            .map_err(falha)
    }
}

#[derive(sqlx::FromRow)]
struct LinhaDoChart {
    arquivo: Vec<u8>,
    midi: bool,
    atraso_ms: f64,
}

#[async_trait]
impl CacheDeCharts for RejulgamentoPostgres {
    async fn buscar(&self, md5: &str) -> Result<Option<ChartGuardado>, FalhaExterna> {
        let linha = sqlx::query_as::<_, LinhaDoChart>("SELECT arquivo, midi, atraso_ms FROM charts_do_encore WHERE md5 = $1")
            .bind(md5)
            .fetch_optional(&self.0)
            .await
            .map_err(falha)?;
        Ok(linha.map(|l| ChartGuardado {
            arquivo: l.arquivo,
            midi: l.midi,
            atraso_ms: l.atraso_ms,
        }))
    }

    async fn guardar(&self, md5: &str, chart: &ChartGuardado) -> Result<(), FalhaExterna> {
        sqlx::query("INSERT INTO charts_do_encore (md5, arquivo, midi, atraso_ms) VALUES ($1, $2, $3, $4) ON CONFLICT (md5) DO NOTHING")
            .bind(md5)
            .bind(&chart.arquivo)
            .bind(chart.midi)
            .bind(chart.atraso_ms)
            .execute(&self.0)
            .await
            .map(|_| ())
            .map_err(falha)
    }
}

#[async_trait]
impl LimiteDePedidos for RejulgamentoPostgres {
    async fn pedir(&self, agora: DateTime<Utc>) -> Result<bool, FalhaExterna> {
        let mut transacao = self.0.begin().await.map_err(falha)?;
        // Uma instância por vez: duas contando juntas passariam do limite.
        sqlx::query("SELECT pg_advisory_xact_lock(hashtext('pedidos_ao_encore'))")
            .execute(&mut *transacao)
            .await
            .map_err(falha)?;
        sqlx::query("DELETE FROM pedidos_ao_encore WHERE feito_em <= $1")
            .bind(inicio_da_janela(agora))
            .execute(&mut *transacao)
            .await
            .map_err(falha)?;
        let feitos: i64 = sqlx::query_scalar("SELECT count(*) FROM pedidos_ao_encore")
            .fetch_one(&mut *transacao)
            .await
            .map_err(falha)?;
        let cabe = cabe_mais_um(u32::try_from(feitos).unwrap_or(u32::MAX));
        if cabe {
            sqlx::query("INSERT INTO pedidos_ao_encore (feito_em) VALUES ($1)")
                .bind(agora)
                .execute(&mut *transacao)
                .await
                .map_err(falha)?;
        }
        transacao.commit().await.map_err(falha)?;
        Ok(cabe)
    }
}
