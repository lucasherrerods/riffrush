pub mod modules;
pub mod shared;

use std::time::Duration;

use axum::http::{header, HeaderValue, Method, StatusCode};
use axum::middleware::map_response;
use axum::routing::get;
use axum::{Json, Router};
use tower::limit::ConcurrencyLimitLayer;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;

use shared::estado::EstadoDoApp;

#[derive(OpenApi)]
#[openapi(
    paths(modules::saude::saude, modules::conta::entrar, modules::conta::sair, modules::conta::eu, modules::conta::excluir, modules::conta::registrar_partida, modules::conta::situacao_da_partida, modules::ranking::ranking, modules::ranking::geral, modules::ranking::musicas, modules::ranking::partida, modules::ranking::replay, modules::perfil::perfil, modules::perfil::recordes, modules::presenca::ficha, modules::moderacao::denunciar, modules::moderacao::denuncias, modules::moderacao::resolver, modules::moderacao::banidos, modules::moderacao::banir, modules::moderacao::desbanir, modules::mania::enviar_partida, modules::mania::situacao_da_partida, modules::mania::ranking, modules::mania::replay, modules::amizade::amigos, modules::amizade::sugestoes, modules::amizade::pedir, modules::amizade::aceitar, modules::amizade::desfazer, modules::amizade::bloquear, modules::amizade::desbloquear),
    components(schemas(
        modules::saude::RespostaDeSaude,
        modules::conta::CorpoDoLogin,
        modules::conta::RespostaDoLogin,
        modules::conta::RespostaDaConta,
        modules::conta::NivelDaConta,
        modules::conta::CorpoDaPartida,
        modules::conta::RespostaDaPartida,
        modules::conta::RespostaDaPartidaNaFila,
        modules::ranking::RespostaDoRanking,
        modules::ranking::PosicaoNoRanking,
        modules::ranking::RespostaDoGeral,
        modules::ranking::PosicaoNoGeral,
        modules::ranking::MusicaNoRanking,
        modules::ranking::RecordeNoRanking,
        modules::ranking::PartidaDoRanking,
        modules::perfil::RespostaDoPerfil,
        modules::perfil::RecordeDaConta,
        modules::presenca::RespostaDaFicha,
        modules::moderacao::CorpoDaDenuncia,
        modules::moderacao::DenunciaDaModeracao,
        modules::moderacao::BanidoDaModeracao,
        modules::perfil::DificuldadeDoPerfil,
        modules::perfil::PartidaDoPerfil,
        modules::perfil::InstrumentoDoPerfil,
        modules::perfil::MusicaDoPerfil,
        modules::perfil::DadosDaMusicaNoPerfil,
        modules::mania::CorpoDaPartidaDoMania,
        modules::mania::RespostaDaPartidaDoManiaNaFila,
        modules::mania::XpDaPartidaDoMania,
        modules::mania::SituacaoDaPartidaDoMania,
        modules::mania::RespostaDoRankingDoMania,
        modules::mania::PosicaoNoRankingDoMania,
        modules::amizade::RespostaDosAmigos,
        modules::amizade::PessoaDaAmizade,
        modules::amizade::SugestaoDeAmizade,
        modules::amizade::CorpoDoPedido,
        modules::amizade::RespostaDoPedido
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

const PEDIDOS_AO_MESMO_TEMPO: usize = 64;
/// Bem acima de qualquer rota normal; o login espera o Google, que tem 20 s no cliente HTTP.
const TEMPO_MAXIMO_DO_PEDIDO: Duration = Duration::from_secs(30);

/// O app inteiro, sem rede: o main serve, os testes de integração chamam direto.
pub fn app(estado: EstadoDoApp, origens_permitidas: &[String]) -> Router {
    let origens: Vec<HeaderValue> = origens_permitidas.iter().filter_map(|o| o.parse().ok()).collect();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origens))
        .allow_methods([Method::GET, Method::POST, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    Router::new()
        .merge(modules::saude::rotas())
        .merge(modules::conta::rotas())
        .merge(modules::ranking::rotas())
        .merge(modules::perfil::rotas())
        .merge(modules::presenca::rotas())
        .merge(modules::moderacao::rotas())
        .merge(modules::mania::rotas())
        .merge(modules::amizade::rotas())
        .route("/openapi.json", get(|| async { Json(Documentacao::openapi()) }))
        .with_state(estado)
        .layer(map_response(shared::erro::padronizar_rejeicoes))
        // O pool do banco tem poucas conexões: além disso os pedidos esperam na fila, e quem demora demais cai.
        .layer(ConcurrencyLimitLayer::new(PEDIDOS_AO_MESMO_TEMPO))
        .layer(TimeoutLayer::with_status_code(StatusCode::GATEWAY_TIMEOUT, TEMPO_MAXIMO_DO_PEDIDO))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::STRICT_TRANSPORT_SECURITY,
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        ))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}
