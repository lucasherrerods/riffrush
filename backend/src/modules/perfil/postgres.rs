use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::dominio::{DadosDoPerfil, EstatisticasDaDificuldade, MusicaMaisTocada, PartidaRecente, PartidasNoInstrumento, MAIS_TOCADAS};
use super::portas::RepositorioDoPerfil;
use crate::modules::conta::FalhaExterna;
use crate::modules::progresso::{Dificuldade, Instrumento};

pub struct PerfilPostgres(pub PgPool);

#[derive(FromRow)]
struct Resumo {
    criada_em: DateTime<Utc>,
    musicas_distintas: i64,
}

#[derive(FromRow)]
struct LinhaDaDificuldade {
    dificuldade: String,
    partidas: i64,
    derrotas: i64,
    acertos: i64,
    notas: i64,
    melhor_pontuacao: i64,
}

#[derive(FromRow)]
struct Contagem {
    chave: String,
    partidas: i64,
}

#[derive(FromRow)]
struct LinhaDaPartida {
    musica_id: String,
    dificuldade: String,
    pontos: i64,
    acertos: i32,
    total: i32,
    derrota: bool,
    jogada_em: DateTime<Utc>,
}

const RESUMO: &str = "
    SELECT c.criada_em, (SELECT COUNT(DISTINCT musica_id) FROM partidas WHERE conta_id = c.id) AS musicas_distintas
    FROM contas c WHERE c.id = $1";

const POR_DIFICULDADE: &str = "
    SELECT dificuldade, COUNT(*) AS partidas, COUNT(*) FILTER (WHERE derrota) AS derrotas,
           COALESCE(SUM(acertos), 0)::BIGINT AS acertos, COALESCE(SUM(total), 0)::BIGINT AS notas,
           COALESCE(MAX(pontos) FILTER (WHERE NOT derrota), 0) AS melhor_pontuacao
    FROM partidas WHERE conta_id = $1
    GROUP BY dificuldade";

const POR_INSTRUMENTO: &str = "
    SELECT instrumento AS chave, COUNT(*) AS partidas
    FROM partidas WHERE conta_id = $1
    GROUP BY instrumento";

/// No empate, a que foi tocada por último vem primeiro.
const CONSULTA_DAS_MAIS_TOCADAS: &str = "
    SELECT musica_id AS chave, COUNT(*) AS partidas
    FROM partidas WHERE conta_id = $1
    GROUP BY musica_id
    ORDER BY COUNT(*) DESC, MAX(jogada_em) DESC
    LIMIT $2";

const RECENTES: &str = "
    SELECT musica_id, dificuldade, pontos, acertos, total, derrota, jogada_em
    FROM partidas WHERE conta_id = $1
    ORDER BY jogada_em DESC LIMIT $2";

fn falha(erro: sqlx::Error) -> FalhaExterna {
    FalhaExterna(format!("banco: {erro}"))
}

fn positivo(valor: i64) -> u64 {
    valor.max(0) as u64
}

fn contagem(valor: i64) -> u32 {
    u32::try_from(valor.max(0)).unwrap_or(u32::MAX)
}

#[async_trait]
impl RepositorioDoPerfil for PerfilPostgres {
    async fn dados(&self, conta_id: Uuid, recentes: u32) -> Result<Option<DadosDoPerfil>, FalhaExterna> {
        let Some(resumo) = sqlx::query_as::<_, Resumo>(RESUMO)
            .bind(conta_id)
            .fetch_optional(&self.0)
            .await
            .map_err(falha)?
        else {
            return Ok(None);
        };
        let por_dificuldade = sqlx::query_as::<_, LinhaDaDificuldade>(POR_DIFICULDADE)
            .bind(conta_id)
            .fetch_all(&self.0)
            .await
            .map_err(falha)?
            .into_iter()
            // Uma dificuldade que o domínio não conhece fica de fora, em vez de derrubar o perfil.
            .filter_map(|l| {
                Some(EstatisticasDaDificuldade {
                    dificuldade: Dificuldade::do_texto(&l.dificuldade)?,
                    partidas: contagem(l.partidas),
                    derrotas: contagem(l.derrotas),
                    acertos: positivo(l.acertos),
                    notas: positivo(l.notas),
                    melhor_pontuacao: positivo(l.melhor_pontuacao),
                })
            })
            .collect();
        let por_instrumento = sqlx::query_as::<_, Contagem>(POR_INSTRUMENTO)
            .bind(conta_id)
            .fetch_all(&self.0)
            .await
            .map_err(falha)?
            .into_iter()
            .filter_map(|l| {
                Some(PartidasNoInstrumento {
                    instrumento: Instrumento::do_texto(&l.chave)?,
                    partidas: contagem(l.partidas),
                })
            })
            .collect();
        let mais_tocadas = sqlx::query_as::<_, Contagem>(CONSULTA_DAS_MAIS_TOCADAS)
            .bind(conta_id)
            .bind(i64::from(MAIS_TOCADAS))
            .fetch_all(&self.0)
            .await
            .map_err(falha)?
            .into_iter()
            .map(|l| MusicaMaisTocada {
                musica_id: l.chave,
                partidas: contagem(l.partidas),
            })
            .collect();
        let recentes = sqlx::query_as::<_, LinhaDaPartida>(RECENTES)
            .bind(conta_id)
            .bind(i64::from(recentes))
            .fetch_all(&self.0)
            .await
            .map_err(falha)?
            .into_iter()
            .filter_map(|l| {
                Some(PartidaRecente {
                    dificuldade: Dificuldade::do_texto(&l.dificuldade)?,
                    musica_id: l.musica_id,
                    pontos: positivo(l.pontos),
                    acertos: l.acertos.max(0) as u32,
                    total: l.total.max(0) as u32,
                    derrota: l.derrota,
                    jogada_em: l.jogada_em,
                })
            })
            .collect();
        Ok(Some(DadosDoPerfil {
            criada_em: resumo.criada_em,
            musicas_distintas: contagem(resumo.musicas_distintas),
            por_dificuldade,
            por_instrumento,
            mais_tocadas,
            recentes,
        }))
    }
}
