//! O Mania pela API inteira (com fakes), o adaptador do Postgres contra um banco de verdade (com `DATABASE_URL`)
//! e o adaptador do osu! contra um servidor de mentira na própria máquina.

mod comum;

use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use base64::prelude::{Engine, BASE64_STANDARD};
use chrono::{Duration, Utc};
use http_body_util::BodyExt;
use riffrush_api::modules::conta::fakes::{pedido, servicos};
use riffrush_api::modules::conta::{ContasPostgres, PerfilDoGoogle, RepositorioDeContas};
use riffrush_api::modules::mania::fakes::{servicos as servicos_do_mania, ManiaEmMemoria, OsuFalso};
use riffrush_api::modules::mania::{
    BeatmapBaixado, BeatmapDoOsu, CredenciaisDoOsu, FonteDeBeatmaps, ManiaPostgres, Osu, PartidaGuardada, PartidaNaFila, PartidaRegistrada, RepositorioDoMania,
    ServicosDoMania,
};
use riffrush_api::modules::saude::VerificadorDoBanco;
use riffrush_api::shared::estado::EstadoDoApp;
use riffrush_motor_mania as motor;
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

struct BancoOk;

#[async_trait]
impl VerificadorDoBanco for BancoOk {
    async fn responde(&self) -> bool {
        true
    }
}

fn mapa(notas: u32) -> String {
    let objetos: String = (0..notas).map(|i| format!("64,192,{},1,0,0:0:0:0:\n", 1000 + i * 200)).collect();
    format!("osu file format v14\n[General]\nMode: 3\n[Difficulty]\nCircleSize:4\nOverallDifficulty:8\nHPDrainRate:5\n[HitObjects]\n{objetos}")
}

fn replay_perfeito(texto: &str, notas: u32) -> Vec<u8> {
    let entradas = (0..notas)
        .flat_map(|i| {
            let tempo = 1000 + i32::try_from(i).unwrap() * 200;
            [
                motor::Entrada {
                    tempo_ms: tempo,
                    coluna: 0,
                    toca: true,
                },
                motor::Entrada {
                    tempo_ms: tempo + 30,
                    coluna: 0,
                    toca: false,
                },
            ]
        })
        .collect();
    motor::empacotar_replay(&motor::Replay {
        mods: motor::Mods::NENHUM,
        semente: 0,
        hash: motor::hash_do_beatmap(texto.as_bytes()),
        entradas,
    })
}

struct Cenario {
    app: Router,
    mania: ServicosDoMania,
    repositorio: Arc<ManiaEmMemoria>,
    token: String,
    texto: String,
}

async fn cenario() -> Cenario {
    let conta = servicos().0;
    let token = conta.entrar_com_google(&pedido("bom")).await.unwrap().token;
    let texto = mapa(400);
    let osu = Arc::new(OsuFalso::com(Ok(BeatmapBaixado::Pronto(BeatmapDoOsu {
        beatmap_id: 42,
        beatmapset_id: Some(7),
        md5: motor::hash_do_beatmap(texto.as_bytes()),
        status: "ranked".into(),
        estrelas: 4.5,
        texto: texto.clone(),
    }))));
    let (mania, repositorio) = servicos_do_mania(conta.clone(), osu);
    let app = riffrush_api::app(
        EstadoDoApp {
            amizade: riffrush_api::modules::amizade::fakes::servicos_de_amizade(conta.clone(), Default::default()).0,
            mania: mania.clone(),
            banco: Arc::new(BancoOk),
            ranking: riffrush_api::modules::ranking::fakes::servicos_do_ranking(conta.clone()).0,
            perfil: riffrush_api::modules::perfil::fakes::servicos_do_perfil(conta.clone()).0,
            moderacao: riffrush_api::modules::moderacao::fakes::servicos_de_moderacao(conta.clone(), None).0,
            presenca: riffrush_api::modules::presenca::ServicosDePresenca {
                moderacao: riffrush_api::modules::moderacao::fakes::servicos_de_moderacao(conta.clone(), None).0,
                conta: conta.clone(),
                segredo: None,
                janelas: Default::default(),
            },
            conta,
        },
        &[],
    );
    Cenario {
        app,
        mania,
        repositorio,
        token,
        texto,
    }
}

async fn chamar(app: &Router, metodo: &str, caminho: &str, token: Option<&str>, corpo: Option<Value>) -> (StatusCode, Value) {
    let mut pedido = Request::builder().method(metodo).uri(caminho).header("content-type", "application/json");
    if let Some(token) = token {
        pedido = pedido.header("authorization", format!("Bearer {token}"));
    }
    let corpo = corpo.map(|c| Body::from(c.to_string())).unwrap_or_default();
    let resposta = app.clone().oneshot(pedido.body(corpo).unwrap()).await.unwrap();
    let status = resposta.status();
    let bytes = resposta.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

#[tokio::test]
async fn enviar_esperar_o_rejulgamento_e_ver_o_xp_e_o_ranking() {
    let c = cenario().await;
    let replay = BASE64_STANDARD.encode(replay_perfeito(&c.texto, 400));
    let (status, corpo) = chamar(
        &c.app,
        "POST",
        "/mania/partidas",
        Some(&c.token),
        Some(json!({ "beatmap_id": 42, "replay": replay })),
    )
    .await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let id = corpo["id"].as_str().unwrap().to_string();

    let (status, corpo) = chamar(&c.app, "GET", &format!("/mania/partidas/{id}/xp"), Some(&c.token), None).await;
    assert_eq!((status, corpo["pendente"].as_bool()), (StatusCode::ACCEPTED, Some(true)));

    c.mania.processar_lote().await.unwrap();
    let (status, corpo) = chamar(&c.app, "GET", &format!("/mania/partidas/{id}/xp"), Some(&c.token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(corpo["xp_ganho"].as_u64().unwrap() > 0);

    let (status, corpo) = chamar(&c.app, "GET", "/mania/ranking/42", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(corpo["linhas"][0]["pontuacao"], 1_000_000);
    let partida = corpo["linhas"][0]["partida_id"].as_str().unwrap().to_string();

    let resposta = c
        .app
        .clone()
        .oneshot(Request::get(format!("/mania/partidas/{partida}/replay")).body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(resposta.status(), StatusCode::OK);
    assert_eq!(c.repositorio.registradas.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn o_envio_recusa_sem_login_replay_que_nao_e_base64_ou_quebrado() {
    let c = cenario().await;
    let corpo = json!({ "beatmap_id": 42, "replay": BASE64_STANDARD.encode([9, 9, 9]) });
    assert_eq!(
        chamar(&c.app, "POST", "/mania/partidas", None, Some(corpo.clone())).await.0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        chamar(&c.app, "POST", "/mania/partidas", Some(&c.token), Some(corpo)).await.0,
        StatusCode::BAD_REQUEST
    );
    let (status, _) = chamar(
        &c.app,
        "POST",
        "/mania/partidas",
        Some(&c.token),
        Some(json!({ "beatmap_id": 42, "replay": "%%%" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn as_rotas_do_mania_estao_no_openapi() {
    let c = cenario().await;
    let (_, doc) = chamar(&c.app, "GET", "/openapi.json", None, None).await;
    for caminho in [
        "/mania/partidas",
        "/mania/partidas/{id}/xp",
        "/mania/partidas/{id}/replay",
        "/mania/ranking/{beatmap_id}",
    ] {
        assert!(doc["paths"].get(caminho).is_some(), "{caminho}");
    }
}

/// Um osu! de mentira: token, a API do beatmap e o .osu.
async fn osu_de_mentira(texto: String, status: &'static str, modo: u8) -> String {
    let md5 = motor::hash_do_beatmap(texto.as_bytes());
    let rotas = Router::new()
        .route(
            "/oauth/token",
            post(|| async { Json(json!({ "access_token": "t", "expires_in": 86400, "token_type": "Bearer" })) }),
        )
        .route(
            "/api/v2/beatmaps/{id}",
            get(move |axum::extract::Path(id): axum::extract::Path<u64>| {
                let md5 = md5.clone();
                async move {
                    if id == 404 {
                        return Err(StatusCode::NOT_FOUND);
                    }
                    Ok(Json(
                        json!({ "mode_int": modo, "status": status, "difficulty_rating": 3.75, "beatmapset_id": 7, "checksum": md5 }),
                    ))
                }
            }),
        )
        .route("/osu/{id}", get(move || async move { texto }));
    let ouvinte = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let endereco = ouvinte.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(ouvinte, rotas).await.unwrap() });
    format!("http://{endereco}")
}

fn credenciais() -> Option<CredenciaisDoOsu> {
    Some(CredenciaisDoOsu {
        client_id: "1".into(),
        client_secret: "s".into(),
    })
}

#[tokio::test]
async fn o_adaptador_do_osu_baixa_o_osu_e_o_status() {
    let texto = mapa(10);
    let osu = Osu::com_url(reqwest::Client::new(), credenciais(), osu_de_mentira(texto.clone(), "loved", 3).await);
    let BeatmapBaixado::Pronto(beatmap) = osu.baixar(42).await.unwrap() else {
        panic!("devia baixar")
    };
    assert_eq!((beatmap.status.as_str(), beatmap.estrelas, beatmap.beatmapset_id), ("loved", 3.75, Some(7)));
    assert_eq!(beatmap.texto, texto);
    assert_eq!(osu.baixar(404).await.unwrap(), BeatmapBaixado::NaoExiste);
}

#[tokio::test]
async fn o_adaptador_do_osu_recusa_outro_modo_e_falha_sem_credenciais() {
    let url = osu_de_mentira(mapa(10), "ranked", 0).await;
    assert_eq!(
        Osu::com_url(reqwest::Client::new(), credenciais(), url.clone()).baixar(42).await.unwrap(),
        BeatmapBaixado::NaoEhMania
    );
    assert!(Osu::com_url(reqwest::Client::new(), None, url).baixar(42).await.is_err());
}

async fn banco() -> Option<PgPool> {
    comum::banco_migrado().await
}

async fn nova_conta(pool: &PgPool, nome: &str) -> Uuid {
    let perfil = PerfilDoGoogle {
        sub: Uuid::new_v4().to_string(),
        nome: nome.into(),
        avatar: None,
        email: None,
    };
    ContasPostgres(pool.clone()).entrar(&perfil, Uuid::new_v4()).await.unwrap().id
}

fn registrada(conta_id: Uuid, beatmap_id: u64, pontuacao: u32, segundos: i64) -> PartidaRegistrada {
    PartidaRegistrada {
        id: Uuid::new_v4(),
        conta_id,
        beatmap_id,
        beatmapset_id: Some(7),
        pontuacao,
        precisao: 0.98,
        contagem: [10, 2, 0, 0, 0, 1],
        maior_combo: 12,
        derrota: false,
        mods: 0,
        xp_ganho: 25,
        vale_ranking: true,
        replay: Some(vec![1, 2, 3]),
        jogada_em: Utc::now() + Duration::seconds(segundos),
    }
}

#[tokio::test]
async fn postgres_fila_registro_com_xp_e_situacao() {
    let Some(pool) = banco().await else { return };
    let repositorio = ManiaPostgres(pool.clone());
    let conta = nova_conta(&pool, "Ana").await;
    let agora = Utc::now();
    let na_fila = PartidaNaFila {
        id: Uuid::new_v4(),
        conta_id: conta,
        beatmap_id: 99,
        replay: vec![1, 2],
        enviada_em: agora,
    };
    repositorio.enfileirar(&na_fila).await.unwrap();
    assert_eq!(
        repositorio.ultima_partida(conta).await.unwrap(),
        Some(na_fila.enviada_em).map(|t| t.trunc_subsecs_micro())
    );
    assert_eq!(repositorio.situacao(conta, na_fila.id).await.unwrap(), Some(PartidaGuardada::NaFila));

    let pegas = repositorio.pegar(50, agora + Duration::seconds(1)).await.unwrap();
    let pega = pegas.iter().find(|p| p.partida.id == na_fila.id).expect("a partida sai da fila");
    assert_eq!((pega.tentativas, pega.partida.beatmap_id), (1, 99));
    // Reservada, não sai de novo.
    assert!(!repositorio
        .pegar(50, agora + Duration::seconds(1))
        .await
        .unwrap()
        .iter()
        .any(|p| p.partida.id == na_fila.id));

    let partida = PartidaRegistrada {
        id: na_fila.id,
        ..registrada(conta, 99, 900_000, 0)
    };
    repositorio.registrar(&partida).await.unwrap();
    // A fila entregou duas vezes: o XP entra uma vez só.
    repositorio.registrar(&partida).await.unwrap();
    let xp: i64 = sqlx::query_scalar("SELECT xp_total FROM contas WHERE id = $1")
        .bind(conta)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(xp, 25);
    assert_eq!(
        repositorio.situacao(conta, na_fila.id).await.unwrap(),
        Some(PartidaGuardada::Registrada { xp_ganho: 25 })
    );
    assert_eq!(
        repositorio
            .partidas_no_mapa(conta, 99, agora - Duration::hours(1), Uuid::new_v4())
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        repositorio.partidas_no_mapa(conta, 99, agora - Duration::hours(1), na_fila.id).await.unwrap(),
        0
    );

    let recusada = PartidaNaFila { id: Uuid::new_v4(), ..na_fila };
    repositorio.enfileirar(&recusada).await.unwrap();
    repositorio.desistir(recusada.id, "o replay é de outro mapa").await.unwrap();
    assert_eq!(repositorio.situacao(conta, recusada.id).await.unwrap(), Some(PartidaGuardada::Recusada));
    assert_eq!(repositorio.situacao(Uuid::new_v4(), recusada.id).await.unwrap(), None);
}

#[tokio::test]
async fn postgres_ranking_pega_o_melhor_de_cada_jogador_e_a_linha_de_quem_pede() {
    let Some(pool) = banco().await else { return };
    let repositorio = ManiaPostgres(pool.clone());
    // Mapa só deste teste.
    let beatmap = u64::from(Uuid::new_v4().as_u128() as u32) + 1_000_000;
    let ana = nova_conta(&pool, "Ana").await;
    let bia = nova_conta(&pool, "Bia").await;
    let caio = nova_conta(&pool, "Caio").await;
    for partida in [
        registrada(ana, beatmap, 800_000, 0),
        registrada(ana, beatmap, 950_000, 1),
        registrada(bia, beatmap, 950_000, 2),
        registrada(caio, beatmap, 500_000, 3),
        // Fora do ranking: não conta.
        PartidaRegistrada {
            vale_ranking: false,
            replay: None,
            ..registrada(caio, beatmap, 999_999, 4)
        },
    ] {
        repositorio.registrar(&partida).await.unwrap();
    }
    let linhas = repositorio.ranking(beatmap, 2, Some(caio)).await.unwrap();
    let resumo: Vec<_> = linhas.iter().map(|l| (l.posicao, l.conta_id, l.pontuacao)).collect();
    assert_eq!(resumo, [(1, ana, 950_000), (2, bia, 950_000), (3, caio, 500_000)]);
    assert_eq!(linhas[0].nome, "Ana");
    assert_eq!(repositorio.replay(linhas[0].partida_id).await.unwrap(), Some(vec![1, 2, 3]));
}

#[tokio::test]
async fn postgres_guarda_o_beatmap_e_conta_os_pedidos_ao_osu() {
    let Some(pool) = banco().await else { return };
    let repositorio = ManiaPostgres(pool.clone());
    let id = u64::from(Uuid::new_v4().as_u128() as u32) + 2_000_000;
    let beatmap = BeatmapDoOsu {
        beatmap_id: id,
        beatmapset_id: None,
        md5: "m".into(),
        status: "ranked".into(),
        estrelas: 2.5,
        texto: "osu".into(),
    };
    assert_eq!(repositorio.beatmap(id).await.unwrap(), None);
    repositorio.guardar_beatmap(&beatmap).await.unwrap();
    repositorio.guardar_beatmap(&beatmap).await.unwrap();
    assert_eq!(repositorio.beatmap(id).await.unwrap(), Some(beatmap));

    // Num instante bem no futuro, para não se misturar com os outros testes.
    let futuro = Utc::now() + Duration::days(3650 + i64::from(Uuid::new_v4().as_u128() as u16));
    let cabem = {
        let mut cabem = 0;
        while repositorio.pedir_ao_osu(futuro).await.unwrap() {
            cabem += 1;
            assert!(cabem <= 40, "o limite não segurou");
        }
        cabem
    };
    assert!(cabem > 0);
    assert!(repositorio.pedir_ao_osu(futuro + Duration::seconds(61)).await.unwrap());
}

trait SemNanos {
    fn trunc_subsecs_micro(self) -> Self;
}

impl SemNanos for chrono::DateTime<Utc> {
    /// O Postgres guarda microssegundos.
    fn trunc_subsecs_micro(self) -> Self {
        use chrono::SubsecRound;
        self.trunc_subsecs(6)
    }
}
