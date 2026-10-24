//! O ranking pela API inteira. O repositório é o fake em memória; o SQL é testado em postgres.rs.

use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use chrono::DateTime;
use http_body_util::BodyExt;
use riffrush_api::modules::conta::fakes::{pedido, servicos};
use riffrush_api::modules::progresso::Dificuldade;
use riffrush_api::modules::ranking::fakes::{servicos_do_ranking, RankingEmMemoria};
use riffrush_api::modules::ranking::LinhaDoRanking;
use riffrush_api::modules::saude::VerificadorDoBanco;
use riffrush_api::shared::estado::EstadoDoApp;
use serde_json::Value;
use tower::ServiceExt;
use uuid::Uuid;

struct BancoOk;

#[async_trait]
impl VerificadorDoBanco for BancoOk {
    async fn responde(&self) -> bool {
        true
    }
}

fn linha(posicao: u32, conta_id: Uuid, nome: &str, pontos: u64) -> LinhaDoRanking {
    LinhaDoRanking {
        posicao,
        jogadores: 928,
        conta_id,
        nome: nome.into(),
        avatar: None,
        pontos,
        acertos: 9,
        total: 10,
        jogada_em: DateTime::UNIX_EPOCH,
    }
}

/// A API com uma conta logada (token devolvido) que está em 578º na música "encore:abc", no expert.
async fn app() -> (Router, String, Arc<RankingEmMemoria>) {
    let conta = servicos().0;
    let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
    let (ranking, repositorio) = servicos_do_ranking(conta.clone());
    *repositorio.linhas.lock().unwrap() = vec![
        ("encore:abc".into(), Dificuldade::Expert, linha(1, Uuid::from_u128(999_999), "Srr 4", 1_099_340)),
        ("encore:abc".into(), Dificuldade::Expert, linha(578, entrada.conta.id, "Lucas", 380_146)),
    ];
    let app = riffrush_api::app(
        EstadoDoApp {
            banco: Arc::new(BancoOk),
            perfil: riffrush_api::modules::perfil::fakes::servicos_do_perfil(conta.clone()).0,
            conta,
            ranking,
        },
        &[],
    );
    (app, entrada.token, repositorio)
}

async fn chamar(app: &Router, caminho: &str, token: Option<&str>) -> (StatusCode, Value) {
    let mut pedido = Request::get(caminho);
    if let Some(token) = token {
        pedido = pedido.header("authorization", format!("Bearer {token}"));
    }
    let resposta = app.clone().oneshot(pedido.body(Body::empty()).unwrap()).await.unwrap();
    let status = resposta.status();
    let bytes = resposta.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

#[tokio::test]
async fn sem_login_devolve_o_top_e_o_total_de_jogadores() {
    let (app, _, _) = app().await;
    let (status, corpo) = chamar(&app, "/ranking?musica_id=encore:abc&dificuldade=expert", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(corpo["jogadores"], 928);
    assert_eq!(corpo["top"][0]["nome"], "Srr 4");
    assert_eq!(corpo["top"][0]["posicao"], 1);
    assert_eq!(corpo["top"].as_array().unwrap().len(), 1);
    assert!(corpo["meu"].is_null());
}

#[tokio::test]
async fn com_login_vem_o_proprio_recorde_fora_do_top() {
    let (app, token, _) = app().await;
    let (_, corpo) = chamar(&app, "/ranking?musica_id=encore:abc&dificuldade=expert", Some(&token)).await;
    assert_eq!(corpo["meu"]["posicao"], 578);
    assert_eq!(corpo["meu"]["pontos"], 380_146);
}

#[tokio::test]
async fn pedido_invalido_e_recusado() {
    let (app, _, _) = app().await;
    assert_eq!(
        chamar(&app, "/ranking?musica_id=encore:abc&dificuldade=impossivel", None).await.0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(chamar(&app, "/ranking?musica_id=&dificuldade=expert", None).await.0, StatusCode::BAD_REQUEST);
    assert_eq!(chamar(&app, "/ranking?dificuldade=expert", None).await.0, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn a_rota_esta_no_openapi() {
    let (app, _, _) = app().await;
    let (_, corpo) = chamar(&app, "/openapi.json", None).await;
    assert!(corpo["paths"]["/ranking"]["get"].is_object());
}
