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
            capa: None,
            musicas_distintas: 1,
            por_dificuldade: vec![EstatisticasDaDificuldade {
                dificuldade: Dificuldade::Expert,
                partidas: 2,
                derrotas: 1,
                valor_dos_acertos: 15 * 300,
                notas: 20,
                melhor_pontuacao: 900,
            }],
            por_instrumento: vec![PartidasNoInstrumento {
                instrumento: Instrumento::Baixo,
                partidas: 2,
            }],
            mais_tocadas: vec![
                MusicaMaisTocada {
                    musica_id: "encore:abc".into(),
                    partidas: 2,
                },
                MusicaMaisTocada {
                    musica_id: "arquivo:Rush - Tom Sawyer.sng:1".into(),
                    partidas: 1,
                },
            ],
            recentes: vec![PartidaRecente {
                musica_id: "encore:abc".into(),
                dificuldade: Dificuldade::Expert,
                pontos: 900,
                acertos: 8,
                total: 10,
                valor_dos_acertos: 8 * 100,
                derrota: false,
                jogada_em: DateTime::UNIX_EPOCH,
            }],
        },
    );
    let app = riffrush_api::app(
        EstadoDoApp {
            amizade: riffrush_api::modules::amizade::fakes::servicos_de_amizade(conta.clone(), Default::default()).0,
            mania: riffrush_api::modules::mania::fakes::servicos_vazios(conta.clone()),
            banco: Arc::new(BancoOk),
            moderacao: riffrush_api::modules::moderacao::fakes::servicos_de_moderacao(conta.clone(), None).0,
            presenca: riffrush_api::modules::presenca::ServicosDePresenca {
                moderacao: riffrush_api::modules::moderacao::fakes::servicos_de_moderacao(conta.clone(), None).0,
                conta: conta.clone(),
                segredo: None,
                janelas: Default::default(),
            },
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
    // 8 ÓTIMOS em 10 notas: 800 de 3000, como no jogo.
    assert!((corpo["recentes"][0]["precisao"].as_f64().unwrap() - 800.0 / 3000.0).abs() < 1e-9);
    assert_eq!(corpo["nivel"]["nivel"], 1);
    assert_eq!(corpo["email"], "lucas@exemplo.com");
    assert_eq!(corpo["por_instrumento"][0]["instrumento"], "baixo");
    assert_eq!(corpo["mais_tocadas"][0]["partidas"], 2);
    // Música que o catálogo não conhece vem sem nome; a do arquivo vem com nome e banda.
    assert!(corpo["mais_tocadas"][0]["titulo"].is_null());
    assert_eq!(corpo["mais_tocadas"][1]["titulo"], "Tom Sawyer");
    assert_eq!(corpo["mais_tocadas"][1]["artista"], "Rush");
    assert!(corpo["recentes"][0]["capa"].is_null());
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

#[tokio::test]
async fn recordes_de_quem_esta_logado() {
    let (app, token) = app().await;
    let (status, corpo) = chamar(&app, "/eu/recordes", Some(&token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(corpo, serde_json::json!([]));
    assert_eq!(chamar(&app, "/eu/recordes", None).await.0, StatusCode::UNAUTHORIZED);

    let (_, openapi) = chamar(&app, "/openapi.json", None).await;
    assert!(openapi["paths"]["/eu/recordes"]["get"].is_object());
}

async fn enviar(app: &Router, metodo: &str, caminho: &str, token: &str, corpo: Vec<u8>) -> (StatusCode, Value) {
    let pedido = Request::builder()
        .method(metodo)
        .uri(caminho)
        .header("authorization", format!("Bearer {token}"))
        .header("content-type", "image/webp")
        .body(Body::from(corpo))
        .unwrap();
    let resposta = app.clone().oneshot(pedido).await.unwrap();
    let status = resposta.status();
    let bytes = resposta.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

#[tokio::test]
async fn troca_a_capa_e_qualquer_um_ve_a_imagem() {
    let (app, token) = app().await;
    let webp = b"RIFF\0\0\0\0WEBPVP8 ".to_vec();

    let (status, corpo) = enviar(&app, "POST", "/eu/imagens/capa", &token, webp.clone()).await;
    assert_eq!(status, StatusCode::OK);
    let endereco = corpo["endereco"].as_str().unwrap();
    let caminho = endereco.trim_start_matches("https://api.exemplo.com");

    let resposta = app.clone().oneshot(Request::get(caminho).body(Body::empty()).unwrap()).await.unwrap();
    assert_eq!(resposta.status(), StatusCode::OK);
    assert_eq!(resposta.headers()["content-type"], "image/webp");
    assert!(resposta.headers()["cache-control"].to_str().unwrap().contains("immutable"));
    assert_eq!(resposta.into_body().collect().await.unwrap().to_bytes().to_vec(), webp);

    assert_eq!(enviar(&app, "DELETE", "/eu/imagens/capa", &token, vec![]).await.0, StatusCode::NO_CONTENT);
    assert_eq!(chamar(&app, caminho, None).await.0, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn recusa_imagem_grande_tipo_desconhecido_e_sem_token() {
    let (app, token) = app().await;
    assert_eq!(
        enviar(&app, "POST", "/eu/imagens/capa", &token, vec![0xFF; 2 * 1024 * 1024]).await.0,
        StatusCode::PAYLOAD_TOO_LARGE
    );
    assert_eq!(
        enviar(&app, "POST", "/eu/imagens/foto", &token, b"<svg/>".to_vec()).await.0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        enviar(&app, "POST", "/eu/imagens/banner", &token, b"RIFF\0\0\0\0WEBP".to_vec()).await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        enviar(&app, "POST", "/eu/imagens/foto", "inventado", b"RIFF\0\0\0\0WEBP".to_vec()).await.0,
        StatusCode::UNAUTHORIZED
    );

    let (_, openapi) = chamar(&app, "/openapi.json", None).await;
    assert!(openapi["paths"]["/eu/imagens/{tipo}"]["post"].is_object());
    assert!(openapi["paths"]["/contas/{id}/imagens/{tipo}"]["get"].is_object());
}
