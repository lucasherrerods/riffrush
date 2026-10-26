//! O fluxo da conta pela API inteira: login, sessão, partidas. As portas são os fakes.

use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use http_body_util::BodyExt;
use riffrush_api::modules::conta::fakes::servicos;
use riffrush_api::modules::ranking::fakes::servicos_do_ranking;
use riffrush_api::modules::saude::VerificadorDoBanco;
use riffrush_api::shared::estado::EstadoDoApp;
use serde_json::{json, Value};
use tower::ServiceExt;

struct BancoOk;

#[async_trait]
impl VerificadorDoBanco for BancoOk {
    async fn responde(&self) -> bool {
        true
    }
}

fn app() -> Router {
    let conta = servicos().0;
    riffrush_api::app(
        EstadoDoApp {
            banco: Arc::new(BancoOk),
            ranking: servicos_do_ranking(conta.clone()).0,
            perfil: riffrush_api::modules::perfil::fakes::servicos_do_perfil(conta.clone()).0,
            moderacao: riffrush_api::modules::moderacao::fakes::servicos_de_moderacao(conta.clone(), None).0,
            presenca: riffrush_api::modules::presenca::ServicosDePresenca {
                moderacao: riffrush_api::modules::moderacao::fakes::servicos_de_moderacao(conta.clone(), None).0,
                conta: conta.clone(),
                segredo: None,
                janelas: Default::default(),
            },
            conta,
        },
        &[],
    )
}

async fn chamar(app: &Router, metodo: &str, caminho: &str, token: Option<&str>, corpo: Option<Value>) -> (StatusCode, Value) {
    let mut pedido = Request::builder().method(metodo).uri(caminho).header("content-type", "application/json");
    if let Some(token) = token {
        pedido = pedido.header("authorization", format!("Bearer {token}"));
    }
    let corpo = corpo.map(|c| Body::from(c.to_string())).unwrap_or_default();
    let resposta = app.clone().oneshot(pedido.body(corpo).unwrap()).await.unwrap();
    let status = resposta.status();
    let bytes = resposta.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

async fn entrar(app: &Router) -> String {
    let (status, corpo) = chamar(
        app,
        "POST",
        "/auth/google",
        None,
        Some(json!({ "codigo": "bom", "verificador": "v", "redirect_uri": "http://localhost" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    corpo["token"].as_str().unwrap().to_string()
}

fn partida() -> Value {
    json!({ "musica_id": "embutida:neon", "dificuldade": "medio", "pontos": 1000, "acertos": 400, "total": 400, "derrota": false })
}

#[tokio::test]
async fn login_devolve_token_e_conta_no_nivel_1() {
    let app = app();
    let (status, corpo) = chamar(
        &app,
        "POST",
        "/auth/google",
        None,
        Some(json!({ "codigo": "bom", "verificador": "v", "redirect_uri": "x" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(corpo["conta"]["nome"], "Lucas");
    assert_eq!(corpo["conta"]["email"], "lucas@exemplo.com");
    assert_eq!(corpo["conta"]["nivel"], json!({ "nivel": 1, "xp_no_nivel": 0, "xp_para_o_proximo": 100 }));
}

#[tokio::test]
async fn login_recusado_da_401() {
    let (status, _) = chamar(
        &app(),
        "POST",
        "/auth/google",
        None,
        Some(json!({ "codigo": "ruim", "verificador": "v", "redirect_uri": "x" })),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn eu_pede_token() {
    let app = app();
    assert_eq!(chamar(&app, "GET", "/eu", None, None).await.0, StatusCode::UNAUTHORIZED);
    assert_eq!(chamar(&app, "GET", "/eu", Some("inventado"), None).await.0, StatusCode::UNAUTHORIZED);
    let token = entrar(&app).await;
    assert_eq!(chamar(&app, "GET", "/eu", Some(&token), None).await.0, StatusCode::OK);
}

#[tokio::test]
async fn partida_sem_chart_conferivel_entra_no_historico_sem_xp() {
    let app = app();
    let token = entrar(&app).await;
    let mut expert = partida();
    expert["dificuldade"] = json!("expert");
    let (status, corpo) = chamar(&app, "POST", "/partidas", Some(&token), Some(expert)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(corpo["xp_ganho"], 0);
    let (_, eu) = chamar(&app, "GET", "/eu", Some(&token), None).await;
    assert_eq!(eu["xp_total"], 0);
}

#[tokio::test]
async fn partida_do_encore_vai_para_a_fila_com_202() {
    let app = app();
    let token = entrar(&app).await;
    let mut do_encore = partida();
    do_encore["musica_id"] = json!("encore:fb0079d4c2e025d5b8dd70724750a923");
    do_encore["replay"] = json!("AgA=");
    let (status, corpo) = chamar(&app, "POST", "/partidas", Some(&token), Some(do_encore.clone())).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    assert_eq!(corpo["pendente"], true);
}

#[tokio::test]
async fn partida_repetida_na_hora_da_429() {
    let app = app();
    let token = entrar(&app).await;
    chamar(&app, "POST", "/partidas", Some(&token), Some(partida())).await;
    assert_eq!(
        chamar(&app, "POST", "/partidas", Some(&token), Some(partida())).await.0,
        StatusCode::TOO_MANY_REQUESTS
    );
}

#[tokio::test]
async fn partida_impossivel_da_400() {
    let app = app();
    let token = entrar(&app).await;
    let mut invalida = partida();
    invalida["acertos"] = json!(9999);
    let (status, corpo) = chamar(&app, "POST", "/partidas", Some(&token), Some(invalida)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(corpo["erro"], "os acertos passam do total de notas");
}

#[tokio::test]
async fn sair_derruba_a_sessao() {
    let app = app();
    let token = entrar(&app).await;
    assert_eq!(chamar(&app, "POST", "/auth/sair", Some(&token), None).await.0, StatusCode::NO_CONTENT);
    assert_eq!(chamar(&app, "GET", "/eu", Some(&token), None).await.0, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn login_aceita_o_cliente_desktop_e_recusa_cliente_desconhecido() {
    let app = app();
    let corpo = |cliente: &str| Some(json!({ "codigo": "bom", "verificador": "v", "redirect_uri": "http://127.0.0.1:5000/", "cliente": cliente }));
    assert_eq!(chamar(&app, "POST", "/auth/google", None, corpo("desktop")).await.0, StatusCode::OK);
    assert_eq!(
        chamar(&app, "POST", "/auth/google", None, corpo("celular")).await.0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
}

#[tokio::test]
async fn excluir_a_conta_derruba_a_sessao() {
    let app = app();
    assert_eq!(chamar(&app, "DELETE", "/eu", None, None).await.0, StatusCode::UNAUTHORIZED);
    let token = entrar(&app).await;
    assert_eq!(chamar(&app, "DELETE", "/eu", Some(&token), None).await.0, StatusCode::NO_CONTENT);
    assert_eq!(chamar(&app, "GET", "/eu", Some(&token), None).await.0, StatusCode::UNAUTHORIZED);
}
