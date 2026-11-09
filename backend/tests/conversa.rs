//! As conversas privadas pela API inteira. Os repositórios são os fakes em memória; o SQL é testado em postgres.rs.

use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use axum::Router;
use http_body_util::BodyExt;
use riffrush_api::modules::amizade::fakes::servicos_de_amizade;
use riffrush_api::modules::conta::fakes::{pedido, servicos};
use riffrush_api::modules::conversa::fakes::{servicos_de_conversa, EntregaFalsa};
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

struct Cena {
    app: Router,
    entrega: Arc<EntregaFalsa>,
    /// (id, token) de cada pessoa.
    ana: (String, String),
    beto: (String, String),
}

/// A API com Ana e Beto logados, ainda sem amizade.
async fn cena() -> Cena {
    let (conta, banco, _) = servicos();
    let ana = conta.entrar_com_google(&pedido("pessoa:ana")).await.unwrap();
    let beto = conta.entrar_com_google(&pedido("pessoa:beto")).await.unwrap();
    let (amizade, amizades) = servicos_de_amizade(conta.clone(), banco);
    let (conversa, _, entrega) = servicos_de_conversa(conta.clone(), amizades);
    let app = riffrush_api::app(
        EstadoDoApp {
            amizade,
            conversa,
            mania: riffrush_api::modules::mania::fakes::servicos_vazios(conta.clone()),
            banco: Arc::new(BancoOk),
            moderacao: riffrush_api::modules::moderacao::fakes::servicos_de_moderacao(conta.clone(), None).0,
            presenca: riffrush_api::modules::presenca::ServicosDePresenca {
                moderacao: riffrush_api::modules::moderacao::fakes::servicos_de_moderacao(conta.clone(), None).0,
                conta: conta.clone(),
                segredo: None,
                janelas: Default::default(),
            },
            ranking: riffrush_api::modules::ranking::fakes::servicos_do_ranking(conta.clone()).0,
            perfil: riffrush_api::modules::perfil::fakes::servicos_do_perfil(conta.clone()).0,
            conta,
        },
        &[],
    );
    Cena {
        app,
        entrega,
        ana: (ana.conta.id.to_string(), ana.token),
        beto: (beto.conta.id.to_string(), beto.token),
    }
}

async fn chamar(app: &Router, metodo: Method, caminho: &str, token: &str, corpo: Option<Value>) -> (StatusCode, Value) {
    let pedido = Request::builder()
        .method(metodo)
        .uri(caminho)
        .header("authorization", format!("Bearer {token}"))
        .header("content-type", "application/json");
    let corpo = corpo.map(|c| Body::from(c.to_string())).unwrap_or_else(Body::empty);
    let resposta = app.clone().oneshot(pedido.body(corpo).unwrap()).await.unwrap();
    let status = resposta.status();
    let bytes = resposta.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

async fn fazer_amizade(c: &Cena) {
    let (status, _) = chamar(&c.app, Method::POST, "/amigos/pedidos", &c.ana.1, Some(json!({ "conta_id": c.beto.0 }))).await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = chamar(&c.app, Method::POST, &format!("/amigos/{}/aceitar", c.ana.0), &c.beto.1, None).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn sem_amizade_a_conversa_e_proibida() {
    let c = cena().await;
    let caminho = format!("/amigos/{}/mensagens", c.beto.0);
    let (status, _) = chamar(&c.app, Method::POST, &caminho, &c.ana.1, Some(json!({ "texto": "oi" }))).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _) = chamar(&c.app, Method::GET, &caminho, &c.ana.1, None).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn amigos_conversam_e_o_historico_e_as_nao_lidas_acompanham() {
    let c = cena().await;
    fazer_amizade(&c).await;

    let (status, enviada) = chamar(
        &c.app,
        Method::POST,
        &format!("/amigos/{}/mensagens", c.beto.0),
        &c.ana.1,
        Some(json!({ "texto": "  bora jogar?  " })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(enviada["texto"], "bora jogar?");
    assert_eq!(enviada["de"], c.ana.0);
    assert_eq!(c.entrega.entregues.lock().unwrap().len(), 1);

    let (status, nao_lidas) = chamar(&c.app, Method::GET, "/conversas/nao-lidas", &c.beto.1, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(nao_lidas, json!([{ "conta_id": c.ana.0, "quantas": 1 }]));

    let (status, historico) = chamar(&c.app, Method::GET, &format!("/amigos/{}/mensagens", c.ana.0), &c.beto.1, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(historico[0]["id"], enviada["id"]);

    let (status, _) = chamar(&c.app, Method::POST, &format!("/amigos/{}/mensagens/lidas", c.ana.0), &c.beto.1, None).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (_, nao_lidas) = chamar(&c.app, Method::GET, "/conversas/nao-lidas", &c.beto.1, None).await;
    assert_eq!(nao_lidas, json!([]));
}

#[tokio::test]
async fn mensagem_vazia_ou_grande_demais_e_recusada() {
    let c = cena().await;
    fazer_amizade(&c).await;
    let caminho = format!("/amigos/{}/mensagens", c.beto.0);
    let (status, _) = chamar(&c.app, Method::POST, &caminho, &c.ana.1, Some(json!({ "texto": "   " }))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = chamar(&c.app, Method::POST, &caminho, &c.ana.1, Some(json!({ "texto": "a".repeat(5_000) }))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn sem_sessao_nao_entra() {
    let c = cena().await;
    let (status, _) = chamar(&c.app, Method::GET, "/conversas/nao-lidas", "token-falso", None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}
