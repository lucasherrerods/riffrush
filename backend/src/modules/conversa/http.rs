use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::casos_de_uso::ErroDaConversa;
use super::dominio::{MensagemPrivada, NaoLidas};
use crate::modules::conta::Token;
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

/// Bem acima do limite do texto: o que passar disso nem chega a ser limpo.
const TAMANHO_MAXIMO_DO_CORPO: usize = 2_000;

impl From<ErroDaConversa> for ErroDaApi {
    fn from(erro: ErroDaConversa) -> Self {
        match erro {
            ErroDaConversa::SessaoInvalida => Self::NaoAutorizado,
            ErroDaConversa::NaoSaoAmigos => Self::Proibido,
            ErroDaConversa::RapidoDemais => Self::MuitasRequisicoes,
            ErroDaConversa::TextoVazio => Self::Invalido(erro.to_string()),
            ErroDaConversa::Falha(falha) => Self::Interno(falha.0),
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct MensagemDaConversa {
    id: i64,
    de: Uuid,
    para: Uuid,
    texto: String,
    enviada_em: DateTime<Utc>,
}

impl From<MensagemPrivada> for MensagemDaConversa {
    fn from(m: MensagemPrivada) -> Self {
        Self {
            id: m.id,
            de: m.de,
            para: m.para,
            texto: m.texto,
            enviada_em: m.enviada_em,
        }
    }
}

#[derive(Deserialize, ToSchema)]
pub struct CorpoDaMensagem {
    texto: String,
}

#[derive(Deserialize, utoipa::IntoParams)]
pub struct Pagina {
    /// O id da mensagem mais velha já carregada: vêm as anteriores a ela.
    antes: Option<i64>,
}

#[derive(Serialize, ToSchema)]
pub struct NaoLidasDoAmigo {
    conta_id: Uuid,
    quantas: u32,
}

impl From<NaoLidas> for NaoLidasDoAmigo {
    fn from(n: NaoLidas) -> Self {
        Self {
            conta_id: n.de,
            quantas: n.quantas,
        }
    }
}

/// Manda uma mensagem para o amigo. Fica guardada e chega na hora se ele estiver online.
#[utoipa::path(post, path = "/amigos/{conta_id}/mensagens", params(("conta_id" = Uuid, Path)), request_body = CorpoDaMensagem, responses((status = 201, body = MensagemDaConversa), (status = 400), (status = 401), (status = 403), (status = 429)), security(("token" = [])))]
pub async fn enviar(
    State(estado): State<EstadoDoApp>,
    Token(token): Token,
    Path(conta_id): Path<Uuid>,
    Json(corpo): Json<CorpoDaMensagem>,
) -> Result<(StatusCode, Json<MensagemDaConversa>), ErroDaApi> {
    if corpo.texto.len() > TAMANHO_MAXIMO_DO_CORPO {
        return Err(ErroDaApi::Invalido("mensagem grande demais".into()));
    }
    let mensagem = estado.conversa.enviar(&token, conta_id, &corpo.texto).await?;
    Ok((StatusCode::CREATED, Json(mensagem.into())))
}

/// A conversa com o amigo, das mais novas para as mais velhas, 50 por vez.
#[utoipa::path(get, path = "/amigos/{conta_id}/mensagens", params(("conta_id" = Uuid, Path), Pagina), responses((status = 200, body = [MensagemDaConversa]), (status = 401), (status = 403)), security(("token" = [])))]
pub async fn historico(
    State(estado): State<EstadoDoApp>,
    Token(token): Token,
    Path(conta_id): Path<Uuid>,
    Query(pagina): Query<Pagina>,
) -> Result<Json<Vec<MensagemDaConversa>>, ErroDaApi> {
    let mensagens = estado.conversa.historico(&token, conta_id, pagina.antes).await?;
    Ok(Json(mensagens.into_iter().map(Into::into).collect()))
}

/// Marca como lido tudo o que o amigo mandou até agora.
#[utoipa::path(post, path = "/amigos/{conta_id}/mensagens/lidas", params(("conta_id" = Uuid, Path)), responses((status = 204), (status = 401)), security(("token" = [])))]
pub async fn marcar_lidas(State(estado): State<EstadoDoApp>, Token(token): Token, Path(conta_id): Path<Uuid>) -> Result<StatusCode, ErroDaApi> {
    estado.conversa.marcar_lidas(&token, conta_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Quantas mensagens cada amigo mandou que a conta ainda não leu.
#[utoipa::path(get, path = "/conversas/nao-lidas", responses((status = 200, body = [NaoLidasDoAmigo]), (status = 401)), security(("token" = [])))]
pub async fn nao_lidas(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<Vec<NaoLidasDoAmigo>>, ErroDaApi> {
    Ok(Json(estado.conversa.nao_lidas(&token).await?.into_iter().map(Into::into).collect()))
}

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new()
        .route("/amigos/{conta_id}/mensagens", get(historico).post(enviar))
        .route("/amigos/{conta_id}/mensagens/lidas", post(marcar_lidas))
        .route("/conversas/nao-lidas", get(nao_lidas))
}
