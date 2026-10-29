use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::dominio::{LinhaDoGeral, LinhaDoRanking, MusicaPopular, Ordem, PartidaPublica, RecordeDaMusica};
use super::portas::RepositorioDoRanking;
use crate::modules::conta::FalhaExterna;
use crate::modules::progresso::{Dificuldade, Instrumento, JeitoDeJogar};

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
    precisao: f64,
    maior_sequencia: Option<i32>,
    jogada_em: DateTime<Utc>,
    jeito_de_jogar: Option<String>,
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
            precisao: l.precisao,
            maior_sequencia: l.maior_sequencia.and_then(|s| u32::try_from(s).ok()),
            jogada_em: l.jogada_em,
            jeito_de_jogar: l.jeito_de_jogar.as_deref().and_then(JeitoDeJogar::do_texto),
        }
    }
}

/// O recorde de cada jogador (a view ordena por pontos e, no empate, por quem chegou primeiro), com o top e a linha de quem pediu.
const CONSULTA: &str = "
    SELECT r.posicao, r.jogadores, r.conta_id, r.partida_id, c.nome, c.avatar, r.pontos, r.acertos, r.total, r.precisao, r.maior_sequencia, r.jogada_em, r.jeito_de_jogar
    FROM recordes_do_ranking r
    JOIN contas c ON c.id = r.conta_id
    WHERE r.musica_id = $1 AND r.dificuldade = $2 AND r.instrumento = $3 AND (r.posicao <= $4 OR r.conta_id = $5)
    ORDER BY r.posicao";

/// O melhor de cada jogador pela precisão, só das partidas que o servidor conferiu, como no ranking pelos pontos.
/// No empate, a maior sequência e depois quem chegou primeiro.
const CONSULTA_POR_PRECISAO: &str = "
    WITH melhores AS (
        SELECT DISTINCT ON (conta_id) id AS partida_id, conta_id, pontos, acertos, total, precisao, maior_sequencia, jogada_em, jeito_de_jogar
        FROM partidas
        WHERE musica_id = $1 AND dificuldade = $2 AND instrumento = $3 AND precisao IS NOT NULL AND NOT derrota AND NOT fantasma
        ORDER BY conta_id, precisao DESC, maior_sequencia DESC NULLS LAST, jogada_em ASC
    ),
    numeradas AS (
        SELECT melhores.*,
               ROW_NUMBER() OVER (ORDER BY precisao DESC, maior_sequencia DESC NULLS LAST, jogada_em ASC) AS posicao,
               COUNT(*) OVER () AS jogadores
        FROM melhores
    )
    SELECT r.posicao, r.jogadores, r.conta_id, r.partida_id, c.nome, c.avatar, r.pontos, r.acertos, r.total, r.precisao, r.maior_sequencia, r.jogada_em, r.jeito_de_jogar
    FROM numeradas r
    JOIN contas c ON c.id = r.conta_id
    WHERE r.posicao <= $4 OR r.conta_id = $5
    ORDER BY r.posicao";

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
    recordista: Option<String>,
    pontos_do_recorde: Option<i64>,
    precisao_do_recorde: Option<f64>,
    dificuldade_do_recorde: Option<String>,
}

/// No empate, a que tem mais jogadores diferentes fica na frente.
/// O recorde é o primeiro lugar pelos pontos na dificuldade mais alta, em qualquer instrumento.
const CONSULTA_DAS_MUSICAS: &str = "
    WITH populares AS (
        SELECT ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, COUNT(DISTINCT conta_id) DESC, musica_id) AS posicao,
               musica_id, COUNT(*) AS partidas, COUNT(DISTINCT conta_id) AS jogadores
        FROM partidas
        GROUP BY musica_id
        ORDER BY posicao
        LIMIT $1
    )
    SELECT p.posicao, p.musica_id, p.partidas, p.jogadores,
           recorde.nome AS recordista, recorde.pontos AS pontos_do_recorde, recorde.precisao AS precisao_do_recorde, recorde.dificuldade AS dificuldade_do_recorde
    FROM populares p
    LEFT JOIN LATERAL (
        SELECT c.nome, r.pontos, r.precisao, r.dificuldade
        FROM recordes_do_ranking r
        JOIN contas c ON c.id = r.conta_id
        WHERE r.musica_id = p.musica_id AND r.posicao = 1
        ORDER BY CASE r.dificuldade WHEN 'expert' THEN 4 WHEN 'dificil' THEN 3 WHEN 'medio' THEN 2 ELSE 1 END DESC, r.pontos DESC
        LIMIT 1
    ) recorde ON true
    ORDER BY p.posicao";

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
    precisao: Option<f64>,
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
            precisao: self.precisao,
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
        ordem: Ordem,
        ate: u32,
        conta: Option<Uuid>,
    ) -> Result<Vec<LinhaDoRanking>, FalhaExterna> {
        let consulta = match ordem {
            Ordem::Pontos => CONSULTA,
            Ordem::Precisao => CONSULTA_POR_PRECISAO,
        };
        sqlx::query_as::<_, Linha>(consulta)
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
                        partidas: contagem(l.partidas),
                        jogadores: contagem(l.jogadores),
                        recorde: match (
                            l.recordista,
                            l.pontos_do_recorde,
                            l.precisao_do_recorde,
                            l.dificuldade_do_recorde.as_deref().and_then(Dificuldade::do_texto),
                        ) {
                            (Some(nome), Some(pontos), Some(precisao), Some(dificuldade)) => Some(RecordeDaMusica {
                                nome,
                                pontos: pontos.max(0) as u64,
                                precisao,
                                dificuldade,
                            }),
                            _ => None,
                        },
                        musica_id: l.musica_id,
                    })
                    .collect()
            })
            .map_err(|erro| FalhaExterna(format!("banco: {erro}")))
    }

    async fn partida(&self, id: Uuid) -> Result<Option<PartidaPublica>, FalhaExterna> {
        let linha = sqlx::query_as::<_, LinhaDaPartida>(
            "SELECT p.id, c.nome, c.avatar, p.musica_id, p.dificuldade, p.instrumento, p.pontos, p.acertos, p.total,
                    p.precisao, p.maior_sequencia, p.derrota, p.fantasma, p.jogada_em, p.replay IS NOT NULL AS tem_replay
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
