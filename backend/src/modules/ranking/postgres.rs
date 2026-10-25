use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::dominio::{LinhaDoGeral, LinhaDoRanking};
use super::portas::RepositorioDoRanking;
use crate::modules::conta::FalhaExterna;
use crate::modules::progresso::{Dificuldade, Instrumento};

pub struct RankingPostgres(pub PgPool);

#[derive(FromRow)]
struct Linha {
    posicao: i64,
    jogadores: i64,
    conta_id: Uuid,
    nome: String,
    avatar: Option<String>,
    pontos: i64,
    acertos: i32,
    total: i32,
    jogada_em: DateTime<Utc>,
}

impl From<Linha> for LinhaDoRanking {
    fn from(l: Linha) -> Self {
        LinhaDoRanking {
            posicao: u32::try_from(l.posicao).unwrap_or(u32::MAX),
            jogadores: u32::try_from(l.jogadores).unwrap_or(u32::MAX),
            conta_id: l.conta_id,
            nome: l.nome,
            avatar: l.avatar,
            pontos: l.pontos.max(0) as u64,
            acertos: l.acertos.max(0) as u32,
            total: l.total.max(0) as u32,
            jogada_em: l.jogada_em,
        }
    }
}

/// Uma partida por jogador (a de mais pontos; no empate, a mais antiga), numeradas, com o top e a linha de quem pediu.
const CONSULTA: &str = "
    WITH melhores AS (
        SELECT DISTINCT ON (conta_id) conta_id, pontos, acertos, total, jogada_em
        FROM partidas
        WHERE musica_id = $1 AND dificuldade = $2 AND instrumento = $3 AND NOT derrota AND NOT fantasma
        ORDER BY conta_id, pontos DESC, jogada_em ASC
    ),
    numerados AS (
        SELECT *, ROW_NUMBER() OVER (ORDER BY pontos DESC, jogada_em ASC) AS posicao, COUNT(*) OVER () AS jogadores
        FROM melhores
    )
    SELECT n.posicao, n.jogadores, n.conta_id, c.nome, c.avatar, n.pontos, n.acertos, n.total, n.jogada_em
    FROM numerados n
    JOIN contas c ON c.id = n.conta_id
    WHERE n.posicao <= $4 OR n.conta_id = $5
    ORDER BY n.posicao";

#[derive(FromRow)]
struct LinhaGeral {
    posicao: i64,
    jogadores: i64,
    conta_id: Uuid,
    nome: String,
    avatar: Option<String>,
    xp_total: i64,
}

impl From<LinhaGeral> for LinhaDoGeral {
    fn from(l: LinhaGeral) -> Self {
        LinhaDoGeral {
            posicao: u32::try_from(l.posicao).unwrap_or(u32::MAX),
            jogadores: u32::try_from(l.jogadores).unwrap_or(u32::MAX),
            conta_id: l.conta_id,
            nome: l.nome,
            avatar: l.avatar,
            xp_total: l.xp_total.max(0) as u64,
        }
    }
}

/// Só contas que já ganharam XP. No empate, quem chegou antes fica na frente.
/// Lê só o top pelo índice; a posição de quem pediu é quantos estão à frente dele, mais um.
const CONSULTA_DO_GERAL: &str = "
    WITH top AS (
        SELECT id, nome, avatar, xp_total, criada_em
        FROM contas
        WHERE xp_total > 0
        ORDER BY xp_total DESC, criada_em ASC
        LIMIT $1
    ),
    total AS (SELECT COUNT(*) AS jogadores FROM contas WHERE xp_total > 0),
    eu AS (
        SELECT id, nome, avatar, xp_total, criada_em
        FROM contas
        WHERE id = $2 AND xp_total > 0 AND id NOT IN (SELECT id FROM top)
    )
    SELECT ROW_NUMBER() OVER (ORDER BY xp_total DESC, criada_em ASC) AS posicao,
           total.jogadores, id AS conta_id, nome, avatar, xp_total
    FROM top, total
    UNION ALL
    SELECT 1 + (SELECT COUNT(*) FROM contas c
                WHERE c.xp_total > eu.xp_total OR (c.xp_total = eu.xp_total AND c.criada_em < eu.criada_em)),
           total.jogadores, eu.id, eu.nome, eu.avatar, eu.xp_total
    FROM eu, total
    ORDER BY posicao";

#[async_trait]
impl RepositorioDoRanking for RankingPostgres {
    async fn linhas(
        &self,
        musica_id: &str,
        dificuldade: Dificuldade,
        instrumento: Instrumento,
        ate: u32,
        conta: Option<Uuid>,
    ) -> Result<Vec<LinhaDoRanking>, FalhaExterna> {
        sqlx::query_as::<_, Linha>(CONSULTA)
            .bind(musica_id)
            .bind(dificuldade.como_texto())
            .bind(instrumento.como_texto())
            .bind(i64::from(ate))
            .bind(conta)
            .fetch_all(&self.0)
            .await
            .map(|linhas| linhas.into_iter().map(LinhaDoRanking::from).collect())
            .map_err(|erro| FalhaExterna(format!("banco: {erro}")))
    }

    async fn geral(&self, ate: u32, conta: Option<Uuid>) -> Result<Vec<LinhaDoGeral>, FalhaExterna> {
        sqlx::query_as::<_, LinhaGeral>(CONSULTA_DO_GERAL)
            .bind(i64::from(ate))
            .bind(conta)
            .fetch_all(&self.0)
            .await
            .map(|linhas| linhas.into_iter().map(LinhaDoGeral::from).collect())
            .map_err(|erro| FalhaExterna(format!("banco: {erro}")))
    }
}
