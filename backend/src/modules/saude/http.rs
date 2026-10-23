use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use utoipa::ToSchema;

use super::casos_de_uso::verificar_saude;
use super::dominio::Situacao;
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

#[derive(Serialize, ToSchema)]
pub struct RespostaDeSaude {
    status: &'static str,
    banco: bool,
}

/// Usada pela hospedagem para saber se a API está de pé.
#[utoipa::path(get, path = "/saude", responses((status = 200, body = RespostaDeSaude), (status = 503)))]
pub async fn saude(State(estado): State<EstadoDoApp>) -> Result<Json<RespostaDeSaude>, ErroDaApi> {
    let saude = verificar_saude(estado.banco.as_ref()).await;
    match saude.situacao {
        Situacao::Ok => Ok(Json(RespostaDeSaude {
            status: "ok",
            banco: saude.banco_ok,
        })),
        Situacao::SemBanco => Err(ErroDaApi::Indisponivel),
    }
}

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new().route("/saude", get(saude))
}
