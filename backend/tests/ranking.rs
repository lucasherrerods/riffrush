//! O ranking pela API inteira. O repositório é o fake em memória; o SQL é testado em postgres.rs.

use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use chrono::DateTime;
use http_body_util::BodyExt;
use riffrush_api::modules::conta::fakes::{pedido, servicos};
use riffrush_api::modules::progresso::{Dificuldade, Instrumento};
use riffrush_api::modules::ranking::fakes::{servicos_do_ranking, RankingEmMemoria};
use riffrush_api::modules::ranking::{LinhaDoGeral, LinhaDoRanking, MusicaPopular, Ordem, PartidaPublica, RecordeDaMusica};
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
        partida_id: Uuid::from_u128(u128::from(posicao) + 1000),
        nome: nome.into(),
        avatar: None,
        pontos,
        acertos: 9,
        total: 10,
        precisao: 0.9,
        maior_sequencia: Some(9),
        jogada_em: DateTime::UNIX_EPOCH,
    }
}

/// A API com uma conta logada (token devolvido) que está em 578º na música "encore:abc", no expert.
async fn app() -> (Router, String, Arc<RankingEmMemoria>) {
    let conta = servicos().0;
    let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
    let (ranking, repositorio) = servicos_do_ranking(conta.clone());
    *repositorio.linhas.lock().unwrap() = vec![
        (
            "encore:abc".into(),
            Dificuldade::Expert,
            Instrumento::Guitarra,
            linha(1, Uuid::from_u128(999_999), "Srr 4", 1_099_340),
        ),
        (
            "encore:abc".into(),
            Dificuldade::Expert,
            Instrumento::Guitarra,
            linha(578, entrada.conta.id, "Lucas", 380_146),
        ),
        (
            "encore:abc".into(),
            Dificuldade::Expert,
            Instrumento::Baixo,
            linha(1, Uuid::from_u128(7), "Baixista", 50_000),
        ),
    ];
    let app = riffrush_api::app(
        EstadoDoApp {
            banco: Arc::new(BancoOk),
            moderacao: riffrush_api::modules::moderacao::fakes::servicos_de_moderacao(conta.clone(), None).0,
            presenca: riffrush_api::modules::presenca::ServicosDePresenca {
                moderacao: riffrush_api::modules::moderacao::fakes::servicos_de_moderacao(conta.clone(), None).0,
                conta: conta.clone(),
                segredo: None,
                janelas: Default::default(),
            },
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
async fn cada_instrumento_tem_o_proprio_ranking_e_sem_ele_vale_a_guitarra() {
    let (app, _, _) = app().await;
    let (_, guitarra) = chamar(&app, "/ranking?musica_id=encore:abc&dificuldade=expert&instrumento=guitarra", None).await;
    assert_eq!(guitarra["top"][0]["nome"], "Srr 4");
    let (_, baixo) = chamar(&app, "/ranking?musica_id=encore:abc&dificuldade=expert&instrumento=baixo", None).await;
    assert_eq!(baixo["top"][0]["nome"], "Baixista");
    assert_eq!(baixo["top"].as_array().unwrap().len(), 1);
    assert_eq!(
        chamar(&app, "/ranking?musica_id=encore:abc&dificuldade=expert&instrumento=bateria", None)
            .await
            .0,
        StatusCode::BAD_REQUEST
    );
}

#[tokio::test]
async fn a_ordem_vem_do_pedido_e_sem_ela_valem_os_pontos() {
    let (app, _, repositorio) = app().await;
    chamar(&app, "/ranking?musica_id=encore:abc&dificuldade=expert", None).await;
    assert_eq!(*repositorio.ultima_ordem.lock().unwrap(), Some(Ordem::Pontos));
    let (status, _) = chamar(&app, "/ranking?musica_id=encore:abc&dificuldade=expert&ordem=precisao", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(*repositorio.ultima_ordem.lock().unwrap(), Some(Ordem::Precisao));
    assert_eq!(
        chamar(&app, "/ranking?musica_id=encore:abc&dificuldade=expert&ordem=sorte", None).await.0,
        StatusCode::BAD_REQUEST
    );
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

#[tokio::test]
async fn o_geral_traz_o_top_por_xp_com_nivel_e_a_propria_posicao() {
    let (app, token, repositorio) = app().await;
    let (_, eu) = chamar(&app, "/eu", Some(&token)).await;
    let minha_conta = uuid::Uuid::parse_str(eu["id"].as_str().unwrap()).unwrap();
    *repositorio.geral.lock().unwrap() = vec![
        LinhaDoGeral {
            posicao: 1,
            jogadores: 40,
            conta_id: Uuid::from_u128(999_999),
            nome: "Srr 4".into(),
            avatar: None,
            xp_total: 100,
        },
        LinhaDoGeral {
            posicao: 63,
            jogadores: 40,
            conta_id: minha_conta,
            nome: "Lucas".into(),
            avatar: None,
            xp_total: 5,
        },
    ];

    let (status, corpo) = chamar(&app, "/ranking/geral", Some(&token)).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(corpo["jogadores"], 40);
    assert_eq!(corpo["top"][0]["nome"], "Srr 4");
    assert_eq!(corpo["top"][0]["nivel"]["nivel"], 2);
    assert_eq!(corpo["meu"]["posicao"], 63);
    assert!(chamar(&app, "/ranking/geral", None).await.1["meu"].is_null());
    assert!(chamar(&app, "/openapi.json", None).await.1["paths"]["/ranking/geral"]["get"].is_object());
}

#[tokio::test]
async fn as_musicas_mais_jogadas_vem_com_partidas_e_jogadores() {
    let (app, _, repositorio) = app().await;
    *repositorio.musicas.lock().unwrap() = vec![MusicaPopular {
        posicao: 1,
        musica_id: "arquivo:Rush - Tom Sawyer.sng:19724630".into(),
        partidas: 30,
        jogadores: 4,
        recorde: Some(RecordeDaMusica {
            nome: "Ana".into(),
            pontos: 1_200_000,
            precisao: 0.98,
            dificuldade: Dificuldade::Expert,
        }),
    }];

    let (status, corpo) = chamar(&app, "/ranking/musicas", None).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(corpo[0]["musica_id"], "arquivo:Rush - Tom Sawyer.sng:19724630");
    assert_eq!(corpo[0]["titulo"], "Tom Sawyer");
    assert_eq!(corpo[0]["artista"], "Rush");
    assert!(corpo[0]["capa"].is_null());
    assert_eq!(corpo[0]["partidas"], 30);
    assert_eq!(corpo[0]["jogadores"], 4);
    assert_eq!(corpo[0]["recorde"]["nome"], "Ana");
    assert_eq!(corpo[0]["recorde"]["pontos"], 1_200_000);
    assert_eq!(corpo[0]["recorde"]["precisao"], 0.98);
    assert_eq!(corpo[0]["recorde"]["dificuldade"], "expert");
    assert!(chamar(&app, "/openapi.json", None).await.1["paths"]["/ranking/musicas"]["get"].is_object());
}

#[tokio::test]
async fn cada_linha_do_ranking_traz_o_id_da_partida() {
    let (app, _, _) = app().await;
    let (_, corpo) = chamar(&app, "/ranking?musica_id=encore:abc&dificuldade=expert", None).await;
    assert_eq!(corpo["top"][0]["partida_id"], Uuid::from_u128(1001).to_string());
}

#[tokio::test]
async fn a_partida_do_ranking_e_publica_e_traz_as_estatisticas() {
    let (app, _, repositorio) = app().await;
    let id = Uuid::from_u128(42);
    *repositorio.partidas.lock().unwrap() = vec![PartidaPublica {
        id,
        nome: "Srr 4".into(),
        avatar: None,
        musica_id: "encore:abc".into(),
        dificuldade: Dificuldade::Expert,
        instrumento: Instrumento::Baixo,
        pontos: 1_099_340,
        acertos: 9,
        total: 10,
        precisao: Some(0.9),
        maior_sequencia: Some(7),
        derrota: false,
        fantasma: false,
        jogada_em: DateTime::UNIX_EPOCH,
        tem_replay: true,
    }];

    let (status, corpo) = chamar(&app, &format!("/partidas/{id}"), None).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(corpo["nome"], "Srr 4");
    assert_eq!(corpo["dificuldade"], "expert");
    assert_eq!(corpo["instrumento"], "baixo");
    assert_eq!(corpo["maior_sequencia"], 7);
    assert_eq!(corpo["acertos"], 9);
    assert_eq!(corpo["tem_replay"], true);
}

#[tokio::test]
async fn partida_que_nao_existe_e_404() {
    let (app, _, _) = app().await;
    let (status, _) = chamar(&app, &format!("/partidas/{}", Uuid::from_u128(1)), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = chamar(&app, "/partidas/nao-e-uuid", None).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn o_replay_da_partida_vem_em_bytes_e_sem_replay_e_404() {
    let (app, _, repositorio) = app().await;
    let id = Uuid::from_u128(42);
    *repositorio.replays.lock().unwrap() = vec![(id, vec![1, 9, 8, 7])];

    let resposta = app
        .clone()
        .oneshot(Request::get(format!("/partidas/{id}/replay")).body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(resposta.status(), StatusCode::OK);
    assert_eq!(resposta.headers()["content-type"], "application/octet-stream");
    assert_eq!(resposta.into_body().collect().await.unwrap().to_bytes().as_ref(), [1, 9, 8, 7]);

    let (status, _) = chamar(&app, &format!("/partidas/{}/replay", Uuid::from_u128(1)), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}
