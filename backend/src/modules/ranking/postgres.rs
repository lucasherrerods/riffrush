use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::dominio::{LinhaDoGeral, LinhaDoRanking, MusicaPopular, PartidaPublica};
use super::portas::RepositorioDoRanking;
use crate::modules::conta::FalhaExterna;
use crate::modules::progresso::{Dificuldade, Instrumento};

pub struct RankingPostgres(pub PgPool);

#[derive(FromRow)]
struct Linha {
    posicao: i64,
    jogadores: i64,
    conta_id: Uuid,
    partida_id: Uuid,
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
            partida_id: l.partida_id,
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
        SELECT DISTINCT ON (conta_id) id AS partida_id, conta_id, pontos, acertos, total, jogada_em
        FROM partidas
        WHERE musica_id = $1 AND dificuldade = $2 AND instrumento = $3 AND NOT derrota AND NOT fantasma
        ORDER BY conta_id, pontos DESC, jogada_em ASC
    ),
    numerados AS (
        SELECT *, ROW_NUMBER() OVER (ORDER BY pontos DESC, jogada_em ASC) AS posicao, COUNT(*) OVER () AS jogadores
        FROM melhores
    )
    SELECT n.posicao, n.jogadores, n.conta_id, n.partida_id, c.nome, c.avatar, n.pontos, n.acertos, n.total, n.jogada_em
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

#[derive(FromRow)]
struct LinhaDaMusica {
    posicao: i64,
    musica_id: String,
    partidas: i64,
    jogadores: i64,
}

/// No empate, a que tem mais jogadores diferentes fica na frente.
const CONSULTA_DAS_MUSICAS: &str = "
    SELECT ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, COUNT(DISTINCT conta_id) DESC, musica_id) AS posicao,
           musica_id, COUNT(*) AS partidas, COUNT(DISTINCT conta_id) AS jogadores
    FROM partidas
    GROUP BY musica_id
    ORDER BY posicao
    LIMIT $1";

#[derive(FromRow)]
struct LinhaDaPartida {
    id: Uuid,
    nome: String,
    avatar: Option<String>,
    musica_id: String,
    dificuldade: String,
    instrumento: String,
    pontos: i64,
    acertos: i32,
    total: i32,
    maior_sequencia: Option<i32>,
    derrota: bool,
    fantasma: bool,
    jogada_em: DateTime<Utc>,
    tem_replay: bool,
}

impl LinhaDaPartida {
    fn em_dominio(self) -> Result<PartidaPublica, FalhaExterna> {
        let invalido = |campo: &str, valor: &str| FalhaExterna(format!("banco: {campo} inválido: {valor}"));
        Ok(PartidaPublica {
            dificuldade: Dificuldade::do_texto(&self.dificuldade).ok_or_else(|| invalido("dificuldade", &self.dificuldade))?,
            instrumento: Instrumento::do_texto(&self.instrumento).ok_or_else(|| invalido("instrumento", &self.instrumento))?,
            id: self.id,
            nome: self.nome,
            avatar: self.avatar,
            musica_id: self.musica_id,
            pontos: self.pontos.max(0) as u64,
            acertos: self.acertos.max(0) as u32,
            total: self.total.max(0) as u32,
            maior_sequencia: self.maior_sequencia.map(|s| s.max(0) as u32),
            derrota: self.derrota,
            fantasma: self.fantasma,
            jogada_em: self.jogada_em,
            tem_replay: self.tem_replay,
        })
    }
}

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

    async fn musicas(&self, ate: u32) -> Result<Vec<MusicaPopular>, FalhaExterna> {
        let contagem = |n: i64| u32::try_from(n).unwrap_or(u32::MAX);
        sqlx::query_as::<_, LinhaDaMusica>(CONSULTA_DAS_MUSICAS)
            .bind(i64::from(ate))
            .fetch_all(&self.0)
            .await
            .map(|linhas| {
                linhas
                    .into_iter()
                    .map(|l| MusicaPopular {
                        posicao: contagem(l.posicao),
                        musica_id: l.musica_id,
                        partidas: contagem(l.partidas),
                        jogadores: contagem(l.jogadores),
                    })
                    .collect()
            })
            .map_err(|erro| FalhaExterna(format!("banco: {erro}")))
    }

    async fn partida(&self, id: Uuid) -> Result<Option<PartidaPublica>, FalhaExterna> {
        let linha = sqlx::query_as::<_, LinhaDaPartida>(
            "SELECT p.id, c.nome, c.avatar, p.musica_id, p.dificuldade, p.instrumento, p.pontos, p.acertos, p.total,
                    p.maior_sequencia, p.derrota, p.fantasma, p.jogada_em, p.replay IS NOT NULL AS tem_replay
             FROM partidas p JOIN contas c ON c.id = p.conta_id
             WHERE p.id = $1",
        )
        .bind(id)
        .fetch_optional(&self.0)
        .await
        .map_err(|erro| FalhaExterna(format!("banco: {erro}")))?;
        linha.map(LinhaDaPartida::em_dominio).transpose()
    }

    async fn replay(&self, id: Uuid) -> Result<Option<Vec<u8>>, FalhaExterna> {
        sqlx::query_scalar::<_, Option<Vec<u8>>>("SELECT replay FROM partidas WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.0)
            .await
            .map(Option::flatten)
            .map_err(|erro| FalhaExterna(format!("banco: {erro}")))
    }
}
