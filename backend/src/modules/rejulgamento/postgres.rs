use async_trait::async_trait;
use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::dominio::ChartGuardado;
use super::portas::{CacheDeCharts, FilaDoRejulgamento, PartidaPendente};
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
        })
    }
}

#[async_trait]
impl FilaDePartidas for RejulgamentoPostgres {
    async fn enfileirar(&self, partida: PartidaNaFila) -> Result<(), FalhaExterna> {
        sqlx::query(
            "INSERT INTO partidas_pendentes (id, conta_id, md5, dificuldade, instrumento, replay, enviada_em, tentar_em)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $7)",
        )
        .bind(partida.id)
        .bind(partida.conta_id)
        .bind(&partida.md5)
        .bind(partida.dificuldade.como_texto())
        .bind(partida.instrumento.como_texto())
        .bind(&partida.replay)
        .bind(partida.enviada_em)
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
             RETURNING id, conta_id, md5, dificuldade, instrumento, replay, enviada_em, tentativas",
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
