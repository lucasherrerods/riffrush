//! As playlists pela API inteira. O repositório é o fake em memória; o SQL roda nos testes com Postgres do CI.

use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use http_body_util::BodyExt;
use riffrush_api::modules::conta::fakes::{pedido, servicos};
use riffrush_api::modules::perfil::fakes::servicos_do_perfil;
use riffrush_api::modules::playlists::fakes::servicos_de_playlists;
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

async fn app() -> (Router, String) {
    let conta = servicos().0;
    let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
    let (amizade, amizades) = riffrush_api::modules::amizade::fakes::servicos_de_amizade(conta.clone(), Default::default());
    let app = riffrush_api::app(
        EstadoDoApp {
            playlists: servicos_de_playlists(conta.clone(), amizades).0,
            amizade,
            mania: riffrush_api::modules::mania::fakes::servicos_vazios(conta.clone()),
            conversa: riffrush_api::modules::conversa::fakes::servicos_vazios(conta.clone()),
            atividades: riffrush_api::modules::atividades::fakes::servicos_de_atividades().0,
            banco: Arc::new(BancoOk),
            moderacao: riffrush_api::modules::moderacao::fakes::servicos_de_moderacao(conta.clone(), None).0,
            presenca: riffrush_api::modules::presenca::ServicosDePresenca {
                moderacao: riffrush_api::modules::moderacao::fakes::servicos_de_moderacao(conta.clone(), None).0,
                conta: conta.clone(),
                segredo: None,
                janelas: Default::default(),
            },
            ranking: servicos_do_ranking(conta.clone()).0,
            perfil: servicos_do_perfil(conta.clone()).0,
            conta,
        },
        &[],
    );
    (app, entrada.token)
}

async fn chamar(app: &Router, metodo: &str, caminho: &str, token: &str, corpo: Option<Value>) -> (StatusCode, Value) {
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

fn playlist(nome: &str, faixas: usize) -> Value {
    let faixas: Vec<Value> = (0..faixas)
        .map(|i| json!({ "musica": format!("encore:{i}"), "versao": "expert", "titulo": "Shine" }))
        .collect();
    json!({ "nome": nome, "modo": "rock", "publica": true, "faixas": faixas })
}

const ID: &str = "00000000-0000-0000-0000-000000000001";

#[tokio::test]
async fn cria_lista_e_apaga() {
    let (app, token) = app().await;
    let (status, criada) = chamar(&app, "PUT", &format!("/eu/playlists/{ID}"), &token, Some(playlist(" Treino ", 2))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(criada["nome"], "Treino");
    assert_eq!(criada["faixas"].as_array().unwrap().len(), 2);

    let (_, lista) = chamar(&app, "GET", "/eu/playlists", &token, None).await;
    assert_eq!(lista[0]["id"], ID);

    assert_eq!(
        chamar(&app, "DELETE", &format!("/eu/playlists/{ID}"), &token, None).await.0,
        StatusCode::NO_CONTENT
    );
    assert_eq!(chamar(&app, "GET", "/eu/playlists", &token, None).await.1, json!([]));
}

#[tokio::test]
async fn recusa_faixas_demais_e_modo_desconhecido() {
    let (app, token) = app().await;
    assert_eq!(
        chamar(&app, "PUT", &format!("/eu/playlists/{ID}"), &token, Some(playlist("A", 51))).await.0,
        StatusCode::BAD_REQUEST
    );
    let mut errada = playlist("A", 1);
    errada["modo"] = json!("taiko");
    assert_eq!(
        chamar(&app, "PUT", &format!("/eu/playlists/{ID}"), &token, Some(errada)).await.0,
        StatusCode::BAD_REQUEST
    );
}

#[tokio::test]
async fn so_amigos_veem_as_playlists() {
    let (app, token) = app().await;
    let outra = "00000000-0000-0000-0000-000000000042";
    assert_eq!(
        chamar(&app, "GET", &format!("/amigos/{outra}/playlists"), &token, None).await.0,
        StatusCode::FORBIDDEN
    );
}

mod no_postgres {
    use chrono::{DateTime, Utc};
    use riffrush_api::modules::conta::{ContasPostgres, PerfilDoGoogle, RepositorioDeContas};
    use riffrush_api::modules::playlists::{Faixa, ModoDaPlaylist, Playlist, PlaylistsPostgres, RepositorioDePlaylists};
    use sqlx::PgPool;
    use uuid::Uuid;

    async fn banco() -> Option<PgPool> {
        let url = std::env::var("DATABASE_URL").ok()?;
        let pool = PgPool::connect(&url).await.expect("o DATABASE_URL não conecta");
        sqlx::migrate!("./migrations").run(&pool).await.expect("as migrações falharam");
        Some(pool)
    }

    async fn nova_conta(pool: &PgPool) -> Uuid {
        let perfil = PerfilDoGoogle {
            sub: Uuid::new_v4().to_string(),
            nome: "Ana".into(),
            avatar: None,
            email: None,
        };
        ContasPostgres(pool.clone()).entrar(&perfil, Uuid::new_v4()).await.unwrap().id
    }

    fn playlist(faixas: &[&str]) -> Playlist {
        Playlist {
            id: Uuid::new_v4(),
            nome: "Treino".into(),
            modo: ModoDaPlaylist::Mania,
            publica: false,
            faixas: faixas
                .iter()
                .map(|m| Faixa {
                    musica: (*m).into(),
                    versao: "hash".into(),
                    titulo: "Mapa".into(),
                })
                .collect(),
            atualizada_em: DateTime::<Utc>::from_timestamp(1_800_000_000, 0).unwrap(),
        }
    }

    #[tokio::test]
    async fn guarda_troca_as_faixas_na_ordem_e_nao_mexe_na_de_outra_conta() {
        let Some(pool) = banco().await else { return };
        let repositorio = PlaylistsPostgres(pool.clone());
        let (ana, bia) = (nova_conta(&pool).await, nova_conta(&pool).await);

        let mut minha = playlist(&["a", "b", "c"]);
        assert!(repositorio.guardar(ana, &minha).await.unwrap());
        minha.faixas.reverse();
        minha.faixas.pop();
        assert!(repositorio.guardar(ana, &minha).await.unwrap());
        let lidas = repositorio.da_conta(ana).await.unwrap();
        assert_eq!(lidas, vec![minha.clone()]);

        assert!(!repositorio.guardar(bia, &minha).await.unwrap());
        repositorio.apagar(bia, minha.id).await.unwrap();
        assert_eq!(repositorio.da_conta(ana).await.unwrap().len(), 1);

        repositorio.apagar(ana, minha.id).await.unwrap();
        assert!(repositorio.da_conta(ana).await.unwrap().is_empty());
    }
}
