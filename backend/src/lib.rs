pub mod modules;
pub mod shared;

use axum::http::{HeaderValue, Method};
use axum::routing::get;
use axum::{Json, Router};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;

use shared::estado::EstadoDoApp;

#[derive(OpenApi)]
#[openapi(paths(modules::saude::saude), components(schemas(modules::saude::RespostaDeSaude)))]
pub struct Documentacao;

/// O app inteiro, sem rede: o main serve, os testes de integração chamam direto.
pub fn app(estado: EstadoDoApp, origens_permitidas: &[String]) -> Router {
    let origens: Vec<HeaderValue> = origens_permitidas.iter().filter_map(|o| o.parse().ok()).collect();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origens))
        .allow_methods([Method::GET, Method::POST, Method::DELETE])
        .allow_headers([axum::http::header::CONTENT_TYPE, axum::http::header::AUTHORIZATION])
        .allow_credentials(true);

    Router::new()
        .merge(modules::saude::rotas())
        .route("/openapi.json", get(|| async { Json(Documentacao::openapi()) }))
        .with_state(estado)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}
