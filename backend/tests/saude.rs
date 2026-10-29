//! Testes da API inteira, pelo roteador, com o banco trocado por um fake.

use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
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

async fn chamar(banco_ok: bool, caminho: &str) -> (StatusCode, Value) {
    let conta = riffrush_api::modules::conta::fakes::servicos().0;
    let app = riffrush_api::app(
        EstadoDoApp {
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
    );
    let resposta = app.oneshot(Request::get(caminho).body(Body::empty()).unwrap()).await.unwrap();
    let status = resposta.status();
    let corpo = resposta.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&corpo).unwrap_or(Value::Null))
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
