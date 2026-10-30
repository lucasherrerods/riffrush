//! Os amigos pela API inteira. O repositório é o fake em memória; o SQL é testado em postgres.rs.

use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use axum::Router;
use http_body_util::BodyExt;
use riffrush_api::modules::amizade::fakes::servicos_de_amizade;
use riffrush_api::modules::conta::fakes::{pedido, servicos};
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

/// A API com duas pessoas logadas: devolve o app e o (id, token) de cada uma.
async fn app() -> (Router, (String, String), (String, String)) {
    let (conta, banco, _) = servicos();
    let ana = conta.entrar_com_google(&pedido("pessoa:ana")).await.unwrap();
    let beto = conta.entrar_com_google(&pedido("pessoa:beto")).await.unwrap();
    let app = riffrush_api::app(
        EstadoDoApp {
            amizade: servicos_de_amizade(conta.clone(), banco).0,
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
    (app, (ana.conta.id.to_string(), ana.token), (beto.conta.id.to_string(), beto.token))
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

#[tokio::test]
async fn pedido_pelo_codigo_aceito_vira_amizade() {
    let (app, (ana_id, ana), (beto_id, beto)) = app().await;
    let (status, do_beto) = chamar(&app, Method::GET, "/amigos", &beto, None).await;
    assert_eq!(status, StatusCode::OK);
    let codigo = do_beto["codigo"].as_str().unwrap().to_string();
    assert!(codigo.starts_with("RIFF-"));

    let (status, pedido) = chamar(&app, Method::POST, "/amigos/pedidos", &ana, Some(json!({ "codigo": codigo }))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(pedido["amigos"], false);

    let (_, do_beto) = chamar(&app, Method::GET, "/amigos", &beto, None).await;
    assert_eq!(do_beto["recebidos"][0]["conta_id"], ana_id);
    assert_eq!(do_beto["recebidos"][0]["nome"], "ana");
    assert_eq!(do_beto["recebidos"][0]["nivel"], 1);

    let (status, _) = chamar(&app, Method::POST, &format!("/amigos/{ana_id}/aceitar"), &beto, None).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (_, da_ana) = chamar(&app, Method::GET, "/amigos", &ana, None).await;
    assert_eq!(da_ana["amigos"][0]["conta_id"], beto_id);
    assert!(da_ana["amigos"][0]["visto_em"].is_string());
    assert_eq!(da_ana["enviados"].as_array().unwrap().len(), 0);

    let (status, _) = chamar(&app, Method::DELETE, &format!("/amigos/{beto_id}"), &ana, None).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (_, da_ana) = chamar(&app, Method::GET, "/amigos", &ana, None).await;
    assert_eq!(da_ana["amigos"].as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn bloqueio_aparece_so_para_quem_bloqueou() {
    let (app, (ana_id, ana), (beto_id, beto)) = app().await;
    let (status, _) = chamar(&app, Method::POST, &format!("/amigos/{beto_id}/bloqueio"), &ana, None).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, _) = chamar(&app, Method::POST, "/amigos/pedidos", &beto, Some(json!({ "conta_id": ana_id }))).await;
    assert_eq!(status, StatusCode::OK);

    let (_, da_ana) = chamar(&app, Method::GET, "/amigos", &ana, None).await;
    assert_eq!(da_ana["bloqueados"][0]["conta_id"], beto_id);
    assert_eq!(da_ana["recebidos"].as_array().unwrap().len(), 0);

    let (status, _) = chamar(&app, Method::DELETE, &format!("/amigos/{beto_id}/bloqueio"), &ana, None).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn corpo_invalido_codigo_de_ninguem_e_sem_sessao() {
    let (app, (ana_id, ana), _) = app().await;
    let (status, _) = chamar(&app, Method::POST, "/amigos/pedidos", &ana, Some(json!({}))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let longo = "A".repeat(500);
    let (status, _) = chamar(&app, Method::POST, "/amigos/pedidos", &ana, Some(json!({ "codigo": longo }))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = chamar(&app, Method::POST, "/amigos/pedidos", &ana, Some(json!({ "codigo": "RIFF-ABCDEF" }))).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = chamar(&app, Method::POST, "/amigos/pedidos", &ana, Some(json!({ "conta_id": ana_id }))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(chamar(&app, Method::GET, "/amigos", "inventado", None).await.0, StatusCode::UNAUTHORIZED);
    assert_eq!(
        chamar(&app, Method::GET, "/amigos/sugestoes", "inventado", None).await.0,
        StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn as_rotas_estao_no_openapi() {
    let (app, (_, ana), _) = app().await;
    let (_, documento) = chamar(&app, Method::GET, "/openapi.json", &ana, None).await;
    for caminho in [
        "/amigos",
        "/amigos/sugestoes",
        "/amigos/pedidos",
        "/amigos/{conta_id}",
        "/amigos/{conta_id}/aceitar",
        "/amigos/{conta_id}/bloqueio",
    ] {
        assert!(documento["paths"][caminho].is_object(), "{caminho} fora do OpenAPI");
    }
}
