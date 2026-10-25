use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use serde::Serialize;
use utoipa::ToSchema;

use super::casos_de_uso::ErroDaPresenca;
use crate::modules::conta::Token;
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

impl From<ErroDaPresenca> for ErroDaApi {
    fn from(erro: ErroDaPresenca) -> Self {
        match erro {
            ErroDaPresenca::Desligada => Self::Indisponivel,
            ErroDaPresenca::SessaoInvalida => Self::NaoAutorizado,
            ErroDaPresenca::RapidoDemais => Self::MuitasRequisicoes,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDaFicha {
    /// Vai para o relay ao abrir a conexão de presença.
    ficha: String,
}

/// Uma ficha assinada, de poucos minutos, para entrar na lista de quem está online.
#[utoipa::path(post, path = "/presenca/ficha", responses((status = 200, body = RespostaDaFicha), (status = 401), (status = 429), (status = 503)), security(("token" = [])))]
pub async fn ficha(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<RespostaDaFicha>, ErroDaApi> {
    Ok(Json(RespostaDaFicha {
        ficha: estado.presenca.ficha(&token).await?,
    }))
}

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new().route("/presenca/ficha", post(ficha))
}
