//! O perfil pela API inteira. O repositório é o fake em memória; o SQL é testado em postgres.rs.

use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use chrono::DateTime;
use http_body_util::BodyExt;
use riffrush_api::modules::conta::fakes::{pedido, servicos};
use riffrush_api::modules::perfil::fakes::servicos_do_perfil;
use riffrush_api::modules::perfil::{DadosDoPerfil, EstatisticasDaDificuldade, MusicaMaisTocada, PartidaRecente, PartidasNoInstrumento};
use riffrush_api::modules::progresso::{Dificuldade, Instrumento};
use riffrush_api::modules::ranking::fakes::servicos_do_ranking;
use riffrush_api::modules::saude::VerificadorDoBanco;
use riffrush_api::shared::estado::EstadoDoApp;
use serde_json::Value;
use tower::ServiceExt;

struct BancoOk;

#[async_trait]
impl VerificadorDoBanco for BancoOk {
    async fn responde(&self) -> bool {
        true
    }
}

/// A API com uma conta logada que jogou duas partidas no expert.
async fn app() -> (Router, String) {
    let conta = servicos().0;
    let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
    let (perfil, repositorio) = servicos_do_perfil(conta.clone());
    repositorio.dados.lock().unwrap().insert(
        entrada.conta.id,
        DadosDoPerfil {
            criada_em: DateTime::UNIX_EPOCH,
            musicas_distintas: 1,
            por_dificuldade: vec![EstatisticasDaDificuldade {
                dificuldade: Dificuldade::Expert,
                partidas: 2,
                derrotas: 1,
                acertos: 15,
                notas: 20,
                melhor_pontuacao: 900,
            }],
            por_instrumento: vec![PartidasNoInstrumento {
                instrumento: Instrumento::Baixo,
                partidas: 2,
            }],
            mais_tocadas: vec![MusicaMaisTocada {
                musica_id: "encore:abc".into(),
                partidas: 2,
            }],
            recentes: vec![PartidaRecente {
                musica_id: "encore:abc".into(),
                dificuldade: Dificuldade::Expert,
                pontos: 900,
                acertos: 8,
                total: 10,
                derrota: false,
                jogada_em: DateTime::UNIX_EPOCH,
            }],
        },
    );
    let app = riffrush_api::app(
        EstadoDoApp {
            banco: Arc::new(BancoOk),
            ranking: servicos_do_ranking(conta.clone()).0,
            conta,
            perfil,
        },
        &[],
    );
    (app, entrada.token)
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
async fn devolve_as_estatisticas_de_quem_esta_logado() {
    let (app, token) = app().await;
    let (status, corpo) = chamar(&app, "/eu/perfil", Some(&token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(corpo["partidas"], 2);
    assert_eq!(corpo["derrotas"], 1);
    assert_eq!(corpo["precisao"], 0.75);
    assert_eq!(corpo["melhor_pontuacao"], 900);
    assert_eq!(corpo["por_dificuldade"].as_array().unwrap().len(), 4);
    assert_eq!(corpo["por_dificuldade"][3]["dificuldade"], "expert");
    assert_eq!(corpo["recentes"][0]["musica_id"], "encore:abc");
    assert_eq!(corpo["nivel"]["nivel"], 1);
    assert_eq!(corpo["email"], "lucas@exemplo.com");
    assert_eq!(corpo["por_instrumento"][0]["instrumento"], "baixo");
    assert_eq!(corpo["mais_tocadas"][0]["partidas"], 2);
}

#[tokio::test]
async fn sem_token_ou_com_token_invalido_e_401() {
    let (app, _) = app().await;
    assert_eq!(chamar(&app, "/eu/perfil", None).await.0, StatusCode::UNAUTHORIZED);
    assert_eq!(chamar(&app, "/eu/perfil", Some("inventado")).await.0, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn a_rota_esta_no_openapi() {
    let (app, _) = app().await;
    let (_, corpo) = chamar(&app, "/openapi.json", None).await;
    assert!(corpo["paths"]["/eu/perfil"]["get"].is_object());
}
