use axum::extract::{Path, Query, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use base64::prelude::{Engine, BASE64_STANDARD};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::casos_de_uso::{ErroDoMania, Situacao};
use super::portas::LinhaDoRanking;
use crate::modules::conta::{NivelDaConta, Token, TokenOpcional};
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

impl From<ErroDoMania> for ErroDaApi {
    fn from(erro: ErroDoMania) -> Self {
        match erro {
            ErroDoMania::Conta(erro) => erro.into(),
            ErroDoMania::ReplayInvalido | ErroDoMania::MapaInvalido => Self::Invalido(erro.to_string()),
            ErroDoMania::RapidoDemais => Self::MuitasRequisicoes,
            ErroDoMania::NaoEncontrada => Self::NaoEncontrado,
            ErroDoMania::Falha(falha) => Self::Interno(falha.0),
        }
    }
}

#[derive(Deserialize, ToSchema)]
pub struct CorpoDaPartidaDoMania {
    /// O id da dificuldade no osu!.
    beatmap_id: u64,
    /// O replay comprimido pelo app, em base64.
    replay: String,
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDaPartidaDoManiaNaFila {
    pendente: bool,
    id: Uuid,
}

/// Manda uma partida do Mania. O servidor baixa o .osu do osu!, rejulga o replay e só então dá o XP (202).
#[utoipa::path(post, path = "/mania/partidas", request_body = CorpoDaPartidaDoMania, responses((status = 202, body = RespostaDaPartidaDoManiaNaFila), (status = 400), (status = 401), (status = 429)), security(("token" = [])))]
pub async fn enviar_partida(State(estado): State<EstadoDoApp>, Token(token): Token, Json(corpo): Json<CorpoDaPartidaDoMania>) -> Result<Response, ErroDaApi> {
    let replay = BASE64_STANDARD
        .decode(corpo.replay)
        .map_err(|_| ErroDaApi::Invalido("o replay não é base64".into()))?;
    let id = estado.mania.enviar_partida(&token, corpo.beatmap_id, replay).await?;
    Ok((StatusCode::ACCEPTED, Json(RespostaDaPartidaDoManiaNaFila { pendente: true, id })).into_response())
}

#[derive(Serialize, ToSchema)]
pub struct XpDaPartidaDoMania {
    xp_ganho: u64,
    antes: NivelDaConta,
    depois: NivelDaConta,
}

#[derive(Serialize, ToSchema)]
pub struct SituacaoDaPartidaDoMania {
    pendente: bool,
    recusada: bool,
}

/// O XP da partida, quando o servidor terminou de rejulgar (200), ou se ela ainda espera ou foi recusada (202).
#[utoipa::path(get, path = "/mania/partidas/{id}/xp", params(("id" = Uuid, Path)), responses((status = 200, body = XpDaPartidaDoMania), (status = 202, body = SituacaoDaPartidaDoMania), (status = 401), (status = 404)), security(("token" = [])))]
pub async fn situacao_da_partida(State(estado): State<EstadoDoApp>, Token(token): Token, Path(id): Path<Uuid>) -> Result<Response, ErroDaApi> {
    Ok(match estado.mania.situacao(&token, id).await? {
        Situacao::Registrada { xp_ganho, antes, depois } => Json(XpDaPartidaDoMania {
            xp_ganho,
            antes: antes.into(),
            depois: depois.into(),
        })
        .into_response(),
        Situacao::NaFila => (
            StatusCode::ACCEPTED,
            Json(SituacaoDaPartidaDoMania {
                pendente: true,
                recusada: false,
            }),
        )
            .into_response(),
        Situacao::Recusada => (
            StatusCode::ACCEPTED,
            Json(SituacaoDaPartidaDoMania {
                pendente: false,
                recusada: true,
            }),
        )
            .into_response(),
    })
}

#[derive(Serialize, ToSchema)]
pub struct PosicaoNoRankingDoMania {
    posicao: u32,
    partida_id: Uuid,
    conta_id: Uuid,
    nome: String,
    avatar: Option<String>,
    pontuacao: u32,
    precisao: f64,
    maior_combo: u32,
    /// Os bits dos mods, como no replay.
    mods: u32,
    jogada_em: DateTime<Utc>,
    /// Falso nas partidas que só vêm com `todas=true`; elas não têm replay.
    vale_ranking: bool,
}

impl From<LinhaDoRanking> for PosicaoNoRankingDoMania {
    fn from(l: LinhaDoRanking) -> Self {
        Self {
            posicao: l.posicao,
            partida_id: l.partida_id,
            conta_id: l.conta_id,
            nome: l.nome,
            avatar: l.avatar,
            pontuacao: l.pontuacao,
            precisao: l.precisao,
            maior_combo: l.maior_combo,
            mods: l.mods,
            jogada_em: l.jogada_em,
            vale_ranking: l.vale_ranking,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDoRankingDoMania {
    linhas: Vec<PosicaoNoRankingDoMania>,
}

#[derive(Deserialize, utoipa::IntoParams)]
pub struct FiltroDoRankingDoMania {
    /// Inclui as partidas que não valem ranking (Random, derrota, mapa fora do ranked).
    #[serde(default)]
    todas: bool,
}

/// O top 10 da dificuldade, um lugar por jogador, pela pontuação. Logado, a sua linha vem junto se estiver fora.
#[utoipa::path(get, path = "/mania/ranking/{beatmap_id}", params(("beatmap_id" = u64, Path), FiltroDoRankingDoMania), responses((status = 200, body = RespostaDoRankingDoMania)))]
pub async fn ranking(
    State(estado): State<EstadoDoApp>,
    TokenOpcional(token): TokenOpcional,
    Path(beatmap_id): Path<u64>,
    Query(filtro): Query<FiltroDoRankingDoMania>,
) -> Result<Json<RespostaDoRankingDoMania>, ErroDaApi> {
    let linhas = estado.mania.ranking(beatmap_id, filtro.todas, token.as_deref()).await?;
    Ok(Json(RespostaDoRankingDoMania {
        linhas: linhas.into_iter().map(Into::into).collect(),
    }))
}

/// O replay de uma partida do ranking do Mania.
#[utoipa::path(get, path = "/mania/partidas/{id}/replay", params(("id" = Uuid, Path)), responses((status = 200, content_type = "application/octet-stream", body = Vec<u8>), (status = 404)))]
pub async fn replay(State(estado): State<EstadoDoApp>, Path(id): Path<Uuid>) -> Result<impl IntoResponse, ErroDaApi> {
    let bytes = estado.mania.replay(id).await?;
    Ok(([(header::CONTENT_TYPE, "application/octet-stream")], bytes))
}

#[derive(Serialize, ToSchema)]
pub struct RecordeDoMapaDoMania {
    nome: String,
    pontuacao: u32,
    precisao: f64,
}

#[derive(Serialize, ToSchema)]
pub struct MapaMaisJogadoDoMania {
    posicao: u32,
    beatmap_id: u64,
    beatmapset_id: Option<u64>,
    partidas: u32,
    jogadores: u32,
    /// Do `.osu` guardado pelo servidor; sem ele, o app usa o nome da biblioteca.
    titulo: Option<String>,
    artista: Option<String>,
    dificuldade: Option<String>,
    recorde: Option<RecordeDoMapaDoMania>,
}

/// As dificuldades do Mania com mais partidas no ranking, com o primeiro lugar de cada uma.
#[utoipa::path(get, path = "/mania/mapas-mais-jogados", responses((status = 200, body = Vec<MapaMaisJogadoDoMania>)))]
pub async fn mapas_mais_jogados(State(estado): State<EstadoDoApp>) -> Result<Json<Vec<MapaMaisJogadoDoMania>>, ErroDaApi> {
    let mapas = estado.mania.mapas_mais_jogados().await?;
    Ok(Json(
        mapas
            .into_iter()
            .enumerate()
            .map(|(i, m)| MapaMaisJogadoDoMania {
                posicao: i as u32 + 1,
                beatmap_id: m.beatmap_id,
                beatmapset_id: m.beatmapset_id,
                partidas: m.partidas,
                jogadores: m.jogadores,
                titulo: m.titulo,
                artista: m.artista,
                dificuldade: m.dificuldade,
                recorde: m.recorde.map(|r| RecordeDoMapaDoMania {
                    nome: r.nome,
                    pontuacao: r.pontuacao,
                    precisao: r.precisao,
                }),
            })
            .collect(),
    ))
}

#[derive(Serialize, ToSchema)]
pub struct EstatisticasDoManiaNoPerfil {
    partidas: u32,
    mapas: u32,
    precisao_media: f64,
    maior_combo: u32,
    pontuacao_total: u64,
    ss: u32,
    s: u32,
    /// Em quantos mapas a conta está no top 10.
    no_top: u32,
    /// Julgamentos somados, de MAX a Miss.
    contagem: [u64; 6],
}

/// Os números do Mania de quem está logado, só das partidas que entram no ranking.
#[utoipa::path(get, path = "/eu/mania/estatisticas", responses((status = 200, body = EstatisticasDoManiaNoPerfil), (status = 401)), security(("token" = [])))]
pub async fn estatisticas(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<EstatisticasDoManiaNoPerfil>, ErroDaApi> {
    let e = estado.mania.estatisticas(&token).await?;
    Ok(Json(EstatisticasDoManiaNoPerfil {
        partidas: e.partidas,
        mapas: e.mapas,
        precisao_media: e.precisao_media,
        maior_combo: e.maior_combo,
        pontuacao_total: e.pontuacao_total,
        ss: e.ss,
        s: e.s,
        no_top: e.no_top,
        contagem: e.contagem,
    }))
}

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new()
        .route("/mania/mapas-mais-jogados", get(mapas_mais_jogados))
        .route("/eu/mania/estatisticas", get(estatisticas))
        .route("/mania/partidas", post(enviar_partida))
        .route("/mania/partidas/{id}/xp", get(situacao_da_partida))
        .route("/mania/partidas/{id}/replay", get(replay))
        .route("/mania/ranking/{beatmap_id}", get(ranking))
}
