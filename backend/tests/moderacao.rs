//! A moderação pela API inteira: denúncia assinada pelo relay e as rotas da equipe. As portas são os fakes.

use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use http_body_util::BodyExt;
use riffrush_api::modules::conta::fakes::{pedido, servicos};
use riffrush_api::modules::conta::Relogio;
use riffrush_api::modules::moderacao::fakes::{servicos_de_moderacao, ModeracaoEmMemoria, RelayFalso};
use riffrush_api::modules::moderacao::{assinar_pedido, AvisoDeModeracao};
use riffrush_api::modules::ranking::fakes::servicos_do_ranking;
use riffrush_api::modules::saude::VerificadorDoBanco;
use riffrush_api::shared::estado::EstadoDoApp;
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;

struct BancoOk;

#[async_trait]
impl VerificadorDoBanco for BancoOk {
    async fn responde(&self) -> bool {
        true
    }
}

const SEGREDO: &[u8] = b"segredo";

struct Montado {
    app: Router,
    repositorio: Arc<ModeracaoEmMemoria>,
    relay: Arc<RelayFalso>,
    token: String,
    eu: Uuid,
    agora: i64,
}

async fn montar() -> Montado {
    let (conta, _, relogio) = servicos();
    let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
    let (moderacao, repositorio, relay) = servicos_de_moderacao(conta.clone(), Some(SEGREDO));
    repositorio.contas.lock().unwrap().insert(entrada.conta.id, "Eu".into());
    let app = riffrush_api::app(
        EstadoDoApp {
            banco: Arc::new(BancoOk),
            ranking: servicos_do_ranking(conta.clone()).0,
            perfil: riffrush_api::modules::perfil::fakes::servicos_do_perfil(conta.clone()).0,
            presenca: riffrush_api::modules::presenca::ServicosDePresenca {
                moderacao: moderacao.clone(),
                conta: conta.clone(),
                segredo: None,
                janelas: Default::default(),
            },
            moderacao,
            conta,
        },
        &[],
    );
    Montado {
        app,
        repositorio,
        relay,
        token: entrada.token,
        eu: entrada.conta.id,
        agora: relogio.agora().timestamp(),
    }
}

async fn chamar(app: &Router, pedido: Request<Body>) -> (StatusCode, Value) {
    let resposta = app.clone().oneshot(pedido).await.unwrap();
    let status = resposta.status();
    let bytes = resposta.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

fn com_token(metodo: &str, caminho: &str, token: &str) -> Request<Body> {
    Request::builder()
        .method(metodo)
        .uri(caminho)
        .header("authorization", format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap()
}

fn denuncia_do_relay(corpo: &str, hora: i64, assinatura: &str) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri("/moderacao/denuncias")
        .header("content-type", "application/json")
        .header("x-riffrush-hora", hora.to_string())
        .header("x-riffrush-assinatura", assinatura)
        .body(Body::from(corpo.to_string()))
        .unwrap()
}

#[tokio::test]
async fn so_o_relay_consegue_denunciar() {
    let m = montar().await;
    let autor = Uuid::from_u128(5);
    m.repositorio.contas.lock().unwrap().insert(autor, "Ana".into());
    let corpo =
        json!({ "mensagem_n": 3, "autor_id": autor, "autor_nome": "Ana", "texto": "spam", "mensagem_em": 1_800_000_000_000_i64, "denunciante_id": m.eu })
            .to_string();

    let (status, _) = chamar(&m.app, denuncia_do_relay(&corpo, m.agora, "assinatura-falsa")).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    // Assinado para outro corpo não serve.
    let (status, _) = chamar(&m.app, denuncia_do_relay(&corpo, m.agora, &assinar_pedido(SEGREDO, m.agora, b"outro"))).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, _) = chamar(&m.app, denuncia_do_relay(&corpo, m.agora, &assinar_pedido(SEGREDO, m.agora, corpo.as_bytes()))).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(m.repositorio.denuncias.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn so_a_equipe_ve_denuncias_e_bane() {
    let m = montar().await;
    let alvo = Uuid::from_u128(5);
    m.repositorio.contas.lock().unwrap().insert(alvo, "Ana".into());

    let (status, _) = chamar(&m.app, com_token("GET", "/moderacao/denuncias", &m.token)).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _) = chamar(&m.app, com_token("POST", &format!("/moderacao/banidos/{alvo}"), &m.token)).await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    m.repositorio.equipe.lock().unwrap().insert(m.eu);
    let (status, _) = chamar(&m.app, com_token("POST", &format!("/moderacao/banidos/{alvo}"), &m.token)).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, banidos) = chamar(&m.app, com_token("GET", "/moderacao/banidos", &m.token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(banidos, json!([{ "conta_id": alvo, "nome": "Ana" }]));
    let (status, _) = chamar(&m.app, com_token("DELETE", &format!("/moderacao/banidos/{alvo}"), &m.token)).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(
        *m.relay.avisos.lock().unwrap(),
        vec![AvisoDeModeracao::Banir(alvo), AvisoDeModeracao::Desbanir(alvo)]
    );
}
