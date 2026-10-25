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
#[openapi(
    paths(modules::saude::saude, modules::conta::entrar, modules::conta::sair, modules::conta::eu, modules::conta::excluir, modules::conta::registrar_partida, modules::ranking::ranking, modules::ranking::geral, modules::ranking::musicas, modules::ranking::partida, modules::ranking::replay, modules::perfil::perfil, modules::presenca::ficha),
    components(schemas(
        modules::saude::RespostaDeSaude,
        modules::conta::CorpoDoLogin,
        modules::conta::RespostaDoLogin,
        modules::conta::RespostaDaConta,
        modules::conta::NivelDaConta,
        modules::conta::CorpoDaPartida,
        modules::conta::RespostaDaPartida,
        modules::ranking::RespostaDoRanking,
        modules::ranking::PosicaoNoRanking,
        modules::ranking::RespostaDoGeral,
        modules::ranking::PosicaoNoGeral,
        modules::ranking::MusicaNoRanking,
        modules::ranking::PartidaDoRanking,
        modules::perfil::RespostaDoPerfil,
        modules::presenca::RespostaDaFicha,
        modules::perfil::DificuldadeDoPerfil,
        modules::perfil::PartidaDoPerfil,
        modules::perfil::InstrumentoDoPerfil,
        modules::perfil::MusicaDoPerfil
    )),
    modifiers(&Token)
)]
pub struct Documentacao;

/// As rotas da conta pedem `Authorization: Bearer <token>`.
struct Token;

impl utoipa::Modify for Token {
    fn modify(&self, api: &mut utoipa::openapi::OpenApi) {
        use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
        let componentes = api.components.get_or_insert_with(Default::default);
        componentes.add_security_scheme("token", SecurityScheme::Http(HttpBuilder::new().scheme(HttpAuthScheme::Bearer).build()));
    }
}

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
        .merge(modules::conta::rotas())
        .merge(modules::ranking::rotas())
        .merge(modules::perfil::rotas())
        .merge(modules::presenca::rotas())
        .route("/openapi.json", get(|| async { Json(Documentacao::openapi()) }))
        .with_state(estado)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}
