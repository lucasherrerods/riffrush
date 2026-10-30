//! Testes da API inteira, pelo roteador, com o banco trocado por um fake.

use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{HeaderMap, Request, StatusCode};
use http_body_util::BodyExt;
use riffrush_api::modules::saude::VerificadorDoBanco;
use riffrush_api::shared::estado::EstadoDoApp;
use serde_json::Value;
use tower::ServiceExt;

struct BancoFalso(bool);

#[async_trait]
impl VerificadorDoBanco for BancoFalso {
    async fn responde(&self) -> bool {
        self.0
    }
}

fn app(banco_ok: bool) -> axum::Router {
    let conta = riffrush_api::modules::conta::fakes::servicos().0;
    riffrush_api::app(
        EstadoDoApp {
            amizade: riffrush_api::modules::amizade::fakes::servicos_de_amizade(conta.clone(), Default::default()).0,
            mania: riffrush_api::modules::mania::fakes::servicos_vazios(conta.clone()),
            banco: Arc::new(BancoFalso(banco_ok)),
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
        &["http://localhost:1420".into()],
    )
}

async fn pedir(banco_ok: bool, pedido: Request<Body>) -> (StatusCode, HeaderMap, Value) {
    let resposta = app(banco_ok).oneshot(pedido).await.unwrap();
    let (status, cabecalhos) = (resposta.status(), resposta.headers().clone());
    let corpo = resposta.into_body().collect().await.unwrap().to_bytes();
    (status, cabecalhos, serde_json::from_slice(&corpo).unwrap_or(Value::Null))
}

async fn chamar(banco_ok: bool, caminho: &str) -> (StatusCode, Value) {
    let (status, _, corpo) = pedir(banco_ok, Request::get(caminho).body(Body::empty()).unwrap()).await;
    (status, corpo)
}

#[tokio::test]
async fn saude_responde_ok_com_banco() {
    let (status, corpo) = chamar(true, "/saude").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(corpo, serde_json::json!({ "status": "ok", "banco": true }));
}

#[tokio::test]
async fn saude_fica_indisponivel_sem_banco() {
    let (status, corpo) = chamar(false, "/saude").await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(corpo["erro"], "serviço indisponível");
}

#[tokio::test]
async fn documentacao_lista_a_rota_de_saude() {
    let (status, corpo) = chamar(true, "/openapi.json").await;
    assert_eq!(status, StatusCode::OK);
    assert!(corpo["paths"]["/saude"].is_object());
}

#[tokio::test]
async fn as_respostas_levam_os_cabecalhos_de_seguranca() {
    let (_, cabecalhos, _) = pedir(true, Request::get("/saude").body(Body::empty()).unwrap()).await;
    assert_eq!(cabecalhos["x-content-type-options"], "nosniff");
    assert!(cabecalhos["strict-transport-security"].to_str().unwrap().starts_with("max-age="));
}

#[tokio::test]
async fn o_cors_libera_a_origem_do_app_sem_credenciais() {
    let preflight = Request::options("/eu")
        .header("origin", "http://localhost:1420")
        .header("access-control-request-method", "GET")
        .body(Body::empty())
        .unwrap();
    let (_, cabecalhos, _) = pedir(true, preflight).await;
    assert_eq!(cabecalhos["access-control-allow-origin"], "http://localhost:1420");
    assert!(cabecalhos.get("access-control-allow-credentials").is_none());
}

#[tokio::test]
async fn pedido_invalido_responde_no_formato_de_erro_da_api() {
    let (status, corpo) = chamar(true, "/ranking?musica_id=x&dificuldade=zzz").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(corpo["erro"], "pedido inválido");
}
