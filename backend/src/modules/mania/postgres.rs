use async_trait::async_trait;
use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::dominio::{EstatisticasDoMania, MapaPopular, RecordeDoMapa, PRECISAO_DO_S, REPLAYS_POR_MAPA};
use super::portas::{BeatmapDoOsu, LinhaDoRanking, PartidaGuardada, PartidaNaFila, PartidaPendente, PartidaRegistrada, RepositorioDoMania};
use crate::modules::conta::FalhaExterna;

/// Quanto tempo uma partida reservada fica fora da vez. Cobre com folga o download de um .osu.
const RESERVA: Duration = Duration::minutes(10);
/// O osu! pede uso moderado da API; cada mapa novo custa dois ou três pedidos. Fica bem abaixo de 60 por minuto.
const PEDIDOS_AO_OSU: i64 = 40;
const JANELA_DO_OSU: Duration = Duration::seconds(60);

pub struct ManiaPostgres(pub PgPool);

fn falha(erro: sqlx::Error) -> FalhaExterna {
    FalhaExterna(format!("banco: {erro}"))
}

fn id_do_banco(id: u64) -> i64 {
    i64::try_from(id).unwrap_or(i64::MAX)
}

#[derive(sqlx::FromRow)]
struct LinhaPendente {
    id: Uuid,
    conta_id: Uuid,
    beatmap_id: i64,
    replay: Vec<u8>,
    enviada_em: DateTime<Utc>,
    tentativas: i32,
}

#[derive(sqlx::FromRow)]
struct LinhaDoBeatmap {
    beatmap_id: i64,
    beatmapset_id: Option<i64>,
    md5: String,
    status: String,
    estrelas: f64,
    texto: String,
}

#[derive(sqlx::FromRow)]
struct LinhaDoRankingNoBanco {
    posicao: i64,
    partida_id: Uuid,
    conta_id: Uuid,
    nome: String,
    avatar: Option<String>,
    pontuacao: i32,
    precisao: f64,
    maior_combo: i32,
    mods: i32,
    jogada_em: DateTime<Utc>,
}

#[async_trait]
impl RepositorioDoMania for ManiaPostgres {
    async fn enfileirar(&self, partida: &PartidaNaFila) -> Result<(), FalhaExterna> {
        sqlx::query(
            "INSERT INTO partidas_do_mania_pendentes (id, conta_id, beatmap_id, replay, enviada_em, tentar_em)
             VALUES ($1, $2, $3, $4, $5, $5)",
        )
        .bind(partida.id)
        .bind(partida.conta_id)
        .bind(id_do_banco(partida.beatmap_id))
        .bind(&partida.replay)
        .bind(partida.enviada_em)
        .execute(&self.0)
        .await
        .map(|_| ())
        .map_err(falha)
    }

    async fn ultima_partida(&self, conta_id: Uuid) -> Result<Option<DateTime<Utc>>, FalhaExterna> {
        sqlx::query_scalar(
            "SELECT max(quando) FROM (
                 SELECT max(enviada_em) AS quando FROM partidas_do_mania_pendentes WHERE conta_id = $1
                 UNION ALL
                 SELECT max(jogada_em) FROM partidas_do_mania WHERE conta_id = $1
             ) AS todas",
        )
        .bind(conta_id)
        .fetch_one(&self.0)
        .await
        .map_err(falha)
    }

    async fn pegar(&self, limite: u32, agora: DateTime<Utc>) -> Result<Vec<PartidaPendente>, FalhaExterna> {
        // SKIP LOCKED: duas instâncias da API nunca pegam a mesma partida.
        let mut linhas = sqlx::query_as::<_, LinhaPendente>(
            "UPDATE partidas_do_mania_pendentes SET tentar_em = $2, tentativas = tentativas + 1
             WHERE id IN (SELECT id FROM partidas_do_mania_pendentes
                          WHERE desistiu_por IS NULL AND tentar_em <= $1
                          ORDER BY enviada_em LIMIT $3 FOR UPDATE SKIP LOCKED)
             RETURNING id, conta_id, beatmap_id, replay, enviada_em, tentativas",
        )
        .bind(agora)
        .bind(agora + RESERVA)
        .bind(i64::from(limite))
        .fetch_all(&self.0)
        .await
        .map_err(falha)?;
        linhas.sort_by_key(|l| l.enviada_em);
        Ok(linhas
            .into_iter()
            .map(|l| PartidaPendente {
                partida: PartidaNaFila {
                    id: l.id,
                    conta_id: l.conta_id,
                    beatmap_id: u64::try_from(l.beatmap_id).unwrap_or(0),
                    replay: l.replay,
                    enviada_em: l.enviada_em,
                },
                tentativas: u32::try_from(l.tentativas).unwrap_or(0),
            })
            .collect())
    }

    async fn reagendar(&self, id: Uuid, quando: DateTime<Utc>) -> Result<(), FalhaExterna> {
        sqlx::query("UPDATE partidas_do_mania_pendentes SET tentar_em = $2 WHERE id = $1")
            .bind(id)
            .bind(quando)
            .execute(&self.0)
            .await
            .map(|_| ())
            .map_err(falha)
    }

    async fn desistir(&self, id: Uuid, motivo: &str) -> Result<(), FalhaExterna> {
        sqlx::query("UPDATE partidas_do_mania_pendentes SET desistiu_por = $2 WHERE id = $1")
            .bind(id)
            .bind(motivo)
            .execute(&self.0)
            .await
            .map(|_| ())
            .map_err(falha)
    }

    async fn registrar(&self, partida: &PartidaRegistrada) -> Result<(), FalhaExterna> {
        let mut transacao = self.0.begin().await.map_err(falha)?;
        let inserida = sqlx::query(
            "INSERT INTO partidas_do_mania
                 (id, conta_id, beatmap_id, beatmapset_id, pontuacao, precisao, contagem, maior_combo, derrota, mods, xp_ganho, vale_ranking, jogada_em)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(partida.id)
        .bind(partida.conta_id)
        .bind(id_do_banco(partida.beatmap_id))
        .bind(partida.beatmapset_id.map(id_do_banco))
        .bind(i32::try_from(partida.pontuacao).unwrap_or(i32::MAX))
        .bind(partida.precisao)
        .bind(partida.contagem.iter().map(|&c| i32::try_from(c).unwrap_or(i32::MAX)).collect::<Vec<_>>())
        .bind(i32::try_from(partida.maior_combo).unwrap_or(i32::MAX))
        .bind(partida.derrota)
        .bind(i32::try_from(partida.mods).unwrap_or(0))
        .bind(i64::try_from(partida.xp_ganho).unwrap_or(i64::MAX))
        .bind(partida.vale_ranking)
        .bind(partida.jogada_em)
        .execute(&mut *transacao)
        .await
        .map_err(falha)?;
        // A fila pode entregar a mesma partida duas vezes: o XP só entra na primeira.
        if inserida.rows_affected() == 1 {
            sqlx::query("UPDATE contas SET xp_total = xp_total + $2 WHERE id = $1")
                .bind(partida.conta_id)
                .bind(i64::try_from(partida.xp_ganho).unwrap_or(i64::MAX))
                .execute(&mut *transacao)
                .await
                .map_err(falha)?;
        }
        if let (1, Some(replay)) = (inserida.rows_affected(), partida.replay.as_deref()) {
            // Duas partidas do mesmo mapa ao mesmo tempo não podem deixar o top com 11 replays.
            sqlx::query("SELECT pg_advisory_xact_lock(hashtext('replays_do_mania'), $1::int)")
                .bind(i32::try_from(partida.beatmap_id % i32::MAX as u64).unwrap_or(0))
                .execute(&mut *transacao)
                .await
                .map_err(falha)?;
            sqlx::query("INSERT INTO replays_do_mania (partida_id, replay) VALUES ($1, $2) ON CONFLICT (partida_id) DO NOTHING")
                .bind(partida.id)
                .bind(replay)
                .execute(&mut *transacao)
                .await
                .map_err(falha)?;
            // Fica só o replay do melhor de cada conta entre os primeiros do mapa; a partida nova entra e sai na mesma hora se não chegou lá.
            sqlx::query(
                "DELETE FROM replays_do_mania r USING partidas_do_mania p
                 WHERE r.partida_id = p.id AND p.beatmap_id = $1
                   AND r.partida_id NOT IN (
                       SELECT id FROM (
                           SELECT DISTINCT ON (conta_id) id, pontuacao, jogada_em FROM partidas_do_mania
                           WHERE beatmap_id = $1 AND vale_ranking
                           ORDER BY conta_id, pontuacao DESC, jogada_em ASC
                       ) melhores
                       ORDER BY pontuacao DESC, jogada_em ASC
                       LIMIT $2)",
            )
            .bind(id_do_banco(partida.beatmap_id))
            .bind(i64::from(REPLAYS_POR_MAPA))
            .execute(&mut *transacao)
            .await
            .map_err(falha)?;
        }
        sqlx::query("DELETE FROM partidas_do_mania_pendentes WHERE id = $1")
            .bind(partida.id)
            .execute(&mut *transacao)
            .await
            .map_err(falha)?;
        transacao.commit().await.map_err(falha)
    }

    async fn partidas_no_mapa(&self, conta_id: Uuid, beatmap_id: u64, desde: DateTime<Utc>, exceto: Uuid) -> Result<u32, FalhaExterna> {
        let quantas: i64 =
            sqlx::query_scalar("SELECT count(*) FROM partidas_do_mania WHERE conta_id = $1 AND beatmap_id = $2 AND jogada_em >= $3 AND id <> $4")
                .bind(conta_id)
                .bind(id_do_banco(beatmap_id))
                .bind(desde)
                .bind(exceto)
                .fetch_one(&self.0)
                .await
                .map_err(falha)?;
        Ok(u32::try_from(quantas).unwrap_or(u32::MAX))
    }

    async fn situacao(&self, conta_id: Uuid, id: Uuid) -> Result<Option<PartidaGuardada>, FalhaExterna> {
        let registrada: Option<i64> = sqlx::query_scalar("SELECT xp_ganho FROM partidas_do_mania WHERE id = $1 AND conta_id = $2")
            .bind(id)
            .bind(conta_id)
            .fetch_optional(&self.0)
            .await
            .map_err(falha)?;
        if let Some(xp) = registrada {
            return Ok(Some(PartidaGuardada::Registrada {
                xp_ganho: u64::try_from(xp).unwrap_or(0),
            }));
        }
        let pendente: Option<Option<String>> = sqlx::query_scalar("SELECT desistiu_por FROM partidas_do_mania_pendentes WHERE id = $1 AND conta_id = $2")
            .bind(id)
            .bind(conta_id)
            .fetch_optional(&self.0)
            .await
            .map_err(falha)?;
        Ok(pendente.map(|motivo| {
            if motivo.is_some() {
                PartidaGuardada::Recusada
            } else {
                PartidaGuardada::NaFila
            }
        }))
    }

    async fn ranking(&self, beatmap_id: u64, limite: u32, conta: Option<Uuid>) -> Result<Vec<LinhaDoRanking>, FalhaExterna> {
        let linhas = sqlx::query_as::<_, LinhaDoRankingNoBanco>(
            "WITH melhores AS (
                 SELECT DISTINCT ON (p.conta_id) p.id, p.conta_id, p.pontuacao, p.precisao, p.maior_combo, p.mods, p.jogada_em
                 FROM partidas_do_mania p
                 WHERE p.beatmap_id = $1 AND p.vale_ranking
                 ORDER BY p.conta_id, p.pontuacao DESC, p.jogada_em ASC
             ), posicoes AS (
                 SELECT m.*, row_number() OVER (ORDER BY m.pontuacao DESC, m.jogada_em ASC) AS posicao FROM melhores m
             )
             SELECT posicao, ps.id AS partida_id, ps.conta_id, c.nome, c.avatar, ps.pontuacao, ps.precisao, ps.maior_combo, ps.mods, ps.jogada_em
             FROM posicoes ps JOIN contas c ON c.id = ps.conta_id
             WHERE ps.posicao <= $2 OR ps.conta_id = $3
             ORDER BY ps.posicao",
        )
        .bind(id_do_banco(beatmap_id))
        .bind(i64::from(limite))
        .bind(conta)
        .fetch_all(&self.0)
        .await
        .map_err(falha)?;
        Ok(linhas
            .into_iter()
            .map(|l| LinhaDoRanking {
                posicao: u32::try_from(l.posicao).unwrap_or(u32::MAX),
                partida_id: l.partida_id,
                conta_id: l.conta_id,
                nome: l.nome,
                avatar: l.avatar,
                pontuacao: u32::try_from(l.pontuacao).unwrap_or(0),
                precisao: l.precisao,
                maior_combo: u32::try_from(l.maior_combo).unwrap_or(0),
                mods: u32::try_from(l.mods).unwrap_or(0),
                jogada_em: l.jogada_em,
            })
            .collect())
    }

    async fn replay(&self, partida_id: Uuid) -> Result<Option<Vec<u8>>, FalhaExterna> {
        sqlx::query_scalar::<_, Vec<u8>>("SELECT replay FROM replays_do_mania WHERE partida_id = $1")
            .bind(partida_id)
            .fetch_optional(&self.0)
            .await
            .map_err(falha)
    }

    async fn mapas_mais_jogados(&self, limite: u32) -> Result<Vec<(MapaPopular, Option<String>)>, FalhaExterna> {
        let linhas = sqlx::query_as::<_, LinhaDoMapaPopular>(
            "WITH contados AS (
                 SELECT beatmap_id, max(beatmapset_id) AS beatmapset_id, count(*) AS partidas, count(DISTINCT conta_id) AS jogadores
                 FROM partidas_do_mania WHERE vale_ranking
                 GROUP BY beatmap_id
                 ORDER BY count(*) DESC, beatmap_id
                 LIMIT $1
             )
             SELECT ct.beatmap_id, ct.beatmapset_id, ct.partidas, ct.jogadores, b.texto,
                    r.nome AS recorde_nome, r.pontuacao AS recorde_pontuacao, r.precisao AS recorde_precisao
             FROM contados ct
             LEFT JOIN beatmaps_do_osu b ON b.beatmap_id = ct.beatmap_id
             LEFT JOIN LATERAL (
                 SELECT c.nome, p.pontuacao, p.precisao FROM partidas_do_mania p JOIN contas c ON c.id = p.conta_id
                 WHERE p.beatmap_id = ct.beatmap_id AND p.vale_ranking
                 ORDER BY p.pontuacao DESC, p.jogada_em ASC LIMIT 1
             ) r ON true
             ORDER BY ct.partidas DESC, ct.beatmap_id",
        )
        .bind(i64::from(limite))
        .fetch_all(&self.0)
        .await
        .map_err(falha)?;
        Ok(linhas
            .into_iter()
            .map(|l| {
                let recorde = match (l.recorde_nome, l.recorde_pontuacao, l.recorde_precisao) {
                    (Some(nome), Some(pontuacao), Some(precisao)) => Some(RecordeDoMapa {
                        nome,
                        pontuacao: u32::try_from(pontuacao).unwrap_or(0),
                        precisao,
                    }),
                    _ => None,
                };
                let mapa = MapaPopular {
                    beatmap_id: u64::try_from(l.beatmap_id).unwrap_or(0),
                    beatmapset_id: l.beatmapset_id.and_then(|id| u64::try_from(id).ok()),
                    partidas: u32::try_from(l.partidas).unwrap_or(u32::MAX),
                    jogadores: u32::try_from(l.jogadores).unwrap_or(u32::MAX),
                    titulo: None,
                    artista: None,
                    dificuldade: None,
                    recorde,
                };
                (mapa, l.texto)
            })
            .collect())
    }

    async fn estatisticas(&self, conta_id: Uuid) -> Result<EstatisticasDoMania, FalhaExterna> {
        let l = sqlx::query_as::<_, LinhaDasEstatisticas>(
            "SELECT count(*) AS partidas,
                    count(DISTINCT beatmap_id) AS mapas,
                    COALESCE(avg(precisao), 0) AS precisao_media,
                    COALESCE(max(maior_combo), 0) AS maior_combo,
                    COALESCE(sum(pontuacao), 0)::BIGINT AS pontuacao_total,
                    count(*) FILTER (WHERE NOT derrota AND precisao >= 1) AS ss,
                    count(*) FILTER (WHERE NOT derrota AND precisao >= $2 AND precisao < 1) AS s,
                    COALESCE(sum(contagem[1]), 0)::BIGINT AS max, COALESCE(sum(contagem[2]), 0)::BIGINT AS j300,
                    COALESCE(sum(contagem[3]), 0)::BIGINT AS j200, COALESCE(sum(contagem[4]), 0)::BIGINT AS j100,
                    COALESCE(sum(contagem[5]), 0)::BIGINT AS j50, COALESCE(sum(contagem[6]), 0)::BIGINT AS miss,
                    (SELECT count(*) FROM (
                         SELECT conta_id, row_number() OVER (PARTITION BY beatmap_id ORDER BY pontuacao DESC, jogada_em ASC) AS posicao
                         FROM (
                             SELECT DISTINCT ON (beatmap_id, conta_id) beatmap_id, conta_id, pontuacao, jogada_em
                             FROM partidas_do_mania
                             WHERE vale_ranking AND beatmap_id IN (SELECT DISTINCT beatmap_id FROM partidas_do_mania WHERE conta_id = $1 AND vale_ranking)
                             ORDER BY beatmap_id, conta_id, pontuacao DESC, jogada_em ASC
                         ) melhores
                     ) posicoes WHERE conta_id = $1 AND posicao <= $3) AS no_top
             FROM partidas_do_mania WHERE conta_id = $1 AND vale_ranking",
        )
        .bind(conta_id)
        .bind(PRECISAO_DO_S)
        .bind(i64::from(REPLAYS_POR_MAPA))
        .fetch_one(&self.0)
        .await
        .map_err(falha)?;
        let n = |v: i64| u32::try_from(v).unwrap_or(u32::MAX);
        let c = |v: i64| u64::try_from(v).unwrap_or(0);
        Ok(EstatisticasDoMania {
            partidas: n(l.partidas),
            mapas: n(l.mapas),
            precisao_media: l.precisao_media,
            maior_combo: u32::try_from(l.maior_combo).unwrap_or(0),
            pontuacao_total: c(l.pontuacao_total),
            ss: n(l.ss),
            s: n(l.s),
            no_top: n(l.no_top),
            contagem: [c(l.max), c(l.j300), c(l.j200), c(l.j100), c(l.j50), c(l.miss)],
        })
    }

    async fn beatmap(&self, beatmap_id: u64) -> Result<Option<BeatmapDoOsu>, FalhaExterna> {
        let linha =
            sqlx::query_as::<_, LinhaDoBeatmap>("SELECT beatmap_id, beatmapset_id, md5, status, estrelas, texto FROM beatmaps_do_osu WHERE beatmap_id = $1")
                .bind(id_do_banco(beatmap_id))
                .fetch_optional(&self.0)
                .await
                .map_err(falha)?;
        Ok(linha.map(|l| BeatmapDoOsu {
            beatmap_id: u64::try_from(l.beatmap_id).unwrap_or(0),
            beatmapset_id: l.beatmapset_id.and_then(|id| u64::try_from(id).ok()),
            md5: l.md5,
            status: l.status,
            estrelas: l.estrelas,
            texto: l.texto,
        }))
    }

    async fn guardar_beatmap(&self, beatmap: &BeatmapDoOsu) -> Result<(), FalhaExterna> {
        sqlx::query(
            "INSERT INTO beatmaps_do_osu (beatmap_id, beatmapset_id, md5, status, estrelas, texto) VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (beatmap_id) DO NOTHING",
        )
        .bind(id_do_banco(beatmap.beatmap_id))
        .bind(beatmap.beatmapset_id.map(id_do_banco))
        .bind(&beatmap.md5)
        .bind(&beatmap.status)
        .bind(beatmap.estrelas)
        .bind(&beatmap.texto)
        .execute(&self.0)
        .await
        .map(|_| ())
        .map_err(falha)
    }

    async fn pedir_ao_osu(&self, agora: DateTime<Utc>) -> Result<bool, FalhaExterna> {
        let mut transacao = self.0.begin().await.map_err(falha)?;
        // Uma instância por vez: duas contando juntas passariam do limite.
        sqlx::query("SELECT pg_advisory_xact_lock(hashtext('pedidos_ao_osu'))")
            .execute(&mut *transacao)
            .await
            .map_err(falha)?;
        sqlx::query("DELETE FROM pedidos_ao_osu WHERE feito_em <= $1")
            .bind(agora - JANELA_DO_OSU)
            .execute(&mut *transacao)
            .await
            .map_err(falha)?;
        let feitos: i64 = sqlx::query_scalar("SELECT count(*) FROM pedidos_ao_osu")
            .fetch_one(&mut *transacao)
            .await
            .map_err(falha)?;
        let cabe = feitos < PEDIDOS_AO_OSU;
        if cabe {
            sqlx::query("INSERT INTO pedidos_ao_osu (feito_em) VALUES ($1)")
                .bind(agora)
                .execute(&mut *transacao)
                .await
                .map_err(falha)?;
        }
        transacao.commit().await.map_err(falha)?;
        Ok(cabe)
    }
}

#[derive(sqlx::FromRow)]
struct LinhaDoMapaPopular {
    beatmap_id: i64,
    beatmapset_id: Option<i64>,
    partidas: i64,
    jogadores: i64,
    texto: Option<String>,
    recorde_nome: Option<String>,
    recorde_pontuacao: Option<i32>,
    recorde_precisao: Option<f64>,
}

#[derive(sqlx::FromRow)]
struct LinhaDasEstatisticas {
    partidas: i64,
    mapas: i64,
    precisao_media: f64,
    maior_combo: i32,
    pontuacao_total: i64,
    ss: i64,
    s: i64,
    max: i64,
    j300: i64,
    j200: i64,
    j100: i64,
    j50: i64,
    miss: i64,
    no_top: i64,
}
