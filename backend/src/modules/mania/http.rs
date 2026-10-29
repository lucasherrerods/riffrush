use axum::extract::{Path, State};
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
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDoRankingDoMania {
    linhas: Vec<PosicaoNoRankingDoMania>,
}

/// O top 10 da dificuldade, um lugar por jogador, pela pontuação. Logado, a sua linha vem junto se estiver fora.
#[utoipa::path(get, path = "/mania/ranking/{beatmap_id}", params(("beatmap_id" = u64, Path)), responses((status = 200, body = RespostaDoRankingDoMania)))]
pub async fn ranking(
    State(estado): State<EstadoDoApp>,
    TokenOpcional(token): TokenOpcional,
    Path(beatmap_id): Path<u64>,
) -> Result<Json<RespostaDoRankingDoMania>, ErroDaApi> {
    let linhas = estado.mania.ranking(beatmap_id, token.as_deref()).await?;
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

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new()
        .route("/mania/partidas", post(enviar_partida))
        .route("/mania/partidas/{id}/xp", get(situacao_da_partida))
        .route("/mania/partidas/{id}/replay", get(replay))
        .route("/mania/ranking/{beatmap_id}", get(ranking))
}
