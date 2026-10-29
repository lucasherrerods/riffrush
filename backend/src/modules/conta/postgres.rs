use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::dominio::{Conta, PerfilDoGoogle};
use super::portas::{FalhaExterna, PartidaGuardada, PartidaRegistrada, RepositorioDeContas, RepositorioDeSessoes};
use crate::modules::progresso::JeitoDeJogar;
use crate::modules::ranking::TAMANHO_DO_TOP_DA_MUSICA;

pub struct ContasPostgres(pub PgPool);

#[derive(FromRow)]
struct LinhaDaConta {
    id: Uuid,
    nome: String,
    avatar: Option<String>,
    email: Option<String>,
    xp_total: i64,
}

impl From<LinhaDaConta> for Conta {
    fn from(linha: LinhaDaConta) -> Self {
        Conta {
            id: linha.id,
            nome: linha.nome,
            avatar: linha.avatar,
            email: linha.email,
            xp_total: linha.xp_total.max(0) as u64,
        }
    }
}

fn falha(erro: sqlx::Error) -> FalhaExterna {
    FalhaExterna(format!("banco: {erro}"))
}

#[async_trait]
impl RepositorioDeContas for ContasPostgres {
    async fn entrar(&self, perfil: &PerfilDoGoogle, novo_id: Uuid) -> Result<Conta, FalhaExterna> {
        sqlx::query_as::<_, LinhaDaConta>(
            "INSERT INTO contas (id, google_sub, nome, avatar, email) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (google_sub) DO UPDATE SET nome = EXCLUDED.nome, avatar = EXCLUDED.avatar,
                 email = COALESCE(EXCLUDED.email, contas.email)
             RETURNING id, nome, avatar, email, xp_total",
        )
        .bind(novo_id)
        .bind(&perfil.sub)
        .bind(&perfil.nome)
        .bind(&perfil.avatar)
        .bind(&perfil.email)
        .fetch_one(&self.0)
        .await
        .map(Conta::from)
        .map_err(falha)
    }

    async fn buscar(&self, id: Uuid) -> Result<Option<Conta>, FalhaExterna> {
        sqlx::query_as::<_, LinhaDaConta>("SELECT id, nome, avatar, email, xp_total FROM contas WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.0)
            .await
            .map(|linha| linha.map(Conta::from))
            .map_err(falha)
    }

    async fn ultima_partida(&self, conta_id: Uuid) -> Result<Option<DateTime<Utc>>, FalhaExterna> {
        sqlx::query_scalar(
            "SELECT max(quando) FROM (
                SELECT jogada_em AS quando FROM partidas WHERE conta_id = $1
                UNION ALL SELECT enviada_em FROM partidas_pendentes WHERE conta_id = $1
             ) AS todas",
        )
        .bind(conta_id)
        .fetch_one(&self.0)
        .await
        .map_err(falha)
    }

    async fn registrar_partida(&self, partida: &PartidaRegistrada) -> Result<Conta, FalhaExterna> {
        let mut transacao = self.0.begin().await.map_err(falha)?;
        let resumo = &partida.resumo;
        if partida.replay.is_some() {
            // Duas partidas da mesma música chegando juntas decidiriam o top com dados velhos: uma espera a outra.
            sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1 || '|' || $2 || '|' || $3))")
                .bind(&partida.musica_id)
                .bind(resumo.dificuldade.como_texto())
                .bind(partida.instrumento.como_texto())
                .execute(&mut *transacao)
                .await
                .map_err(falha)?;
        }
        let inserida = sqlx::query(
            "INSERT INTO partidas (id, conta_id, musica_id, dificuldade, instrumento, pontos, acertos, total, derrota, fantasma, xp_ganho, jogada_em, maior_sequencia, replay, precisao, valor_dos_acertos, jeito_de_jogar)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(partida.id)
        .bind(partida.conta_id)
        .bind(&partida.musica_id)
        .bind(resumo.dificuldade.como_texto())
        .bind(partida.instrumento.como_texto())
        .bind(i64::try_from(partida.pontos).unwrap_or(i64::MAX))
        .bind(resumo.acertos as i32)
        .bind(resumo.total as i32)
        .bind(resumo.derrota)
        .bind(resumo.fantasma)
        .bind(partida.xp_ganho as i64)
        .bind(partida.jogada_em)
        .bind(resumo.maior_sequencia.map(|s| s as i32))
        .bind(partida.replay.as_deref())
        .bind(partida.precisao)
        .bind(resumo.valor_dos_acertos.map(|v| i32::try_from(v).unwrap_or(i32::MAX)))
        .bind(partida.jeito_de_jogar.map(JeitoDeJogar::como_texto))
        .execute(&mut *transacao)
        .await
        .map_err(falha)?;
        if inserida.rows_affected() == 0 {
            // A partida já foi registrada antes: devolve a conta sem somar o XP de novo.
            transacao.rollback().await.map_err(falha)?;
            return self.buscar(partida.conta_id).await?.ok_or_else(|| FalhaExterna("conta sumiu".into()));
        }
        if partida.replay.is_some() {
            // Só os recordes do top guardam replay: quem saiu do top, ou superou a própria marca, perde o antigo.
            sqlx::query(
                "UPDATE partidas SET replay = NULL
                 WHERE musica_id = $1 AND dificuldade = $2 AND instrumento = $3 AND replay IS NOT NULL
                   AND id NOT IN (SELECT partida_id FROM recordes_do_ranking
                                  WHERE musica_id = $1 AND dificuldade = $2 AND instrumento = $3 AND posicao <= $4)",
            )
            .bind(&partida.musica_id)
            .bind(resumo.dificuldade.como_texto())
            .bind(partida.instrumento.como_texto())
            .bind(i64::from(TAMANHO_DO_TOP_DA_MUSICA))
            .execute(&mut *transacao)
            .await
            .map_err(falha)?;
        }
        let conta = sqlx::query_as::<_, LinhaDaConta>("UPDATE contas SET xp_total = xp_total + $2 WHERE id = $1 RETURNING id, nome, avatar, email, xp_total")
            .bind(partida.conta_id)
            .bind(partida.xp_ganho as i64)
            .fetch_one(&mut *transacao)
            .await
            .map_err(falha)?;
        transacao.commit().await.map_err(falha)?;
        Ok(conta.into())
    }

    async fn partidas_no_chart(&self, conta_id: Uuid, musica_id: &str, desde: DateTime<Utc>, exceto: Uuid) -> Result<u32, FalhaExterna> {
        let quantas: i64 = sqlx::query_scalar("SELECT count(*) FROM partidas WHERE conta_id = $1 AND musica_id = $2 AND jogada_em >= $3 AND id <> $4")
            .bind(conta_id)
            .bind(musica_id)
            .bind(desde)
            .bind(exceto)
            .fetch_one(&self.0)
            .await
            .map_err(falha)?;
        Ok(u32::try_from(quantas).unwrap_or(u32::MAX))
    }

    async fn situacao_da_partida(&self, conta_id: Uuid, id: Uuid) -> Result<Option<PartidaGuardada>, FalhaExterna> {
        let registrada: Option<i64> = sqlx::query_scalar("SELECT xp_ganho FROM partidas WHERE id = $1 AND conta_id = $2")
            .bind(id)
            .bind(conta_id)
            .fetch_optional(&self.0)
            .await
            .map_err(falha)?;
        if let Some(xp_ganho) = registrada {
            return Ok(Some(PartidaGuardada::Registrada {
                xp_ganho: u64::try_from(xp_ganho).unwrap_or(0),
            }));
        }
        let pendente: Option<Option<String>> = sqlx::query_scalar("SELECT desistiu_por FROM partidas_pendentes WHERE id = $1 AND conta_id = $2")
            .bind(id)
            .bind(conta_id)
            .fetch_optional(&self.0)
            .await
            .map_err(falha)?;
        Ok(pendente.map(|desistiu_por| {
            if desistiu_por.is_some() {
                PartidaGuardada::Recusada
            } else {
                PartidaGuardada::NaFila
            }
        }))
    }

    async fn excluir(&self, id: Uuid) -> Result<(), FalhaExterna> {
        // Sessões e partidas saem junto pelo ON DELETE CASCADE.
        sqlx::query("DELETE FROM contas WHERE id = $1")
            .bind(id)
            .execute(&self.0)
            .await
            .map(|_| ())
            .map_err(falha)
    }
}

#[async_trait]
impl RepositorioDeSessoes for ContasPostgres {
    async fn criar(&self, token_hash: &str, conta_id: Uuid, expira_em: DateTime<Utc>) -> Result<(), FalhaExterna> {
        sqlx::query("INSERT INTO sessoes (token_hash, conta_id, expira_em) VALUES ($1, $2, $3)")
            .bind(token_hash)
            .bind(conta_id)
            .bind(expira_em)
            .execute(&self.0)
            .await
            .map(|_| ())
            .map_err(falha)
    }

    async fn conta_da_sessao(&self, token_hash: &str, agora: DateTime<Utc>) -> Result<Option<Uuid>, FalhaExterna> {
        sqlx::query_scalar("SELECT conta_id FROM sessoes WHERE token_hash = $1 AND expira_em > $2")
            .bind(token_hash)
            .bind(agora)
            .fetch_optional(&self.0)
            .await
            .map_err(falha)
    }

    async fn apagar(&self, token_hash: &str) -> Result<(), FalhaExterna> {
        sqlx::query("DELETE FROM sessoes WHERE token_hash = $1")
            .bind(token_hash)
            .execute(&self.0)
            .await
            .map(|_| ())
            .map_err(falha)
    }
}
