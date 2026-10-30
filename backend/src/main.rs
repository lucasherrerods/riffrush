use std::sync::Arc;
use std::time::Duration;

use riffrush_api::modules::amizade::{AmizadesPostgres, ServicosDeAmizade};
use riffrush_api::modules::catalogo::{CatalogoPostgres, Encore, ServicosDoCatalogo};
use riffrush_api::modules::conta::{ContasPostgres, CredenciaisDoGoogle, GeradorAleatorio, Google, RelogioDoSistema, ServicosDaConta};
use riffrush_api::modules::mania::{self, CredenciaisDoOsu, ManiaPostgres, Osu, ServicosDoMania};
use riffrush_api::modules::moderacao::{ModeracaoPostgres, RelayHttp, ServicosDeModeracao};
use riffrush_api::modules::perfil::{PerfilPostgres, ServicosDoPerfil};
use riffrush_api::modules::presenca::ServicosDePresenca;
use riffrush_api::modules::ranking::{RankingPostgres, ServicosDoRanking};
use riffrush_api::modules::rejulgamento::{iniciar_trabalhador, RejulgamentoPostgres, ServicosDoRejulgamento};
use riffrush_api::modules::saude::BancoPostgres;
use riffrush_api::shared::config::Config;
use riffrush_api::shared::estado::EstadoDoApp;
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let config = Config::do_ambiente()?;
    // Sem tempo limite, um Google ou osu! travado deixava os pedidos pendurados para sempre.
    let http = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(20))
        .build()?;
    let banco = PgPoolOptions::new().max_connections(5).connect(&config.url_do_banco).await?;
    sqlx::migrate!("./migrations").run(&banco).await?;

    let contas = Arc::new(ContasPostgres(banco.clone()));
    let rejulgamento = Arc::new(RejulgamentoPostgres(banco.clone()));
    let relogio = Arc::new(RelogioDoSistema);
    let conta = ServicosDaConta {
        contas: contas.clone(),
        sessoes: contas,
        login: Arc::new(Google {
            web: CredenciaisDoGoogle {
                client_id: config.google_client_id.clone(),
                client_secret: config.google_client_secret.clone(),
            },
            desktop: config
                .google_desktop
                .clone()
                .map(|(client_id, client_secret)| CredenciaisDoGoogle { client_id, client_secret }),
            http: http.clone(),
        }),
        relogio: relogio.clone(),
        gerador: Arc::new(GeradorAleatorio),
        fila: rejulgamento.clone(),
        janelas_do_login: Default::default(),
    };
    // Um Encore só: a busca dos nomes e os downloads dos charts dividem o mesmo limite de pedidos.
    let encore = Arc::new(Encore::novo(http.clone(), relogio.clone(), rejulgamento.clone()));
    let catalogo = ServicosDoCatalogo {
        repositorio: Arc::new(CatalogoPostgres(banco.clone())),
        encore: encore.clone(),
    };
    let ranking = ServicosDoRanking {
        repositorio: Arc::new(RankingPostgres(banco.clone())),
        conta: conta.clone(),
        catalogo: catalogo.clone(),
    };
    let perfil = ServicosDoPerfil {
        repositorio: Arc::new(PerfilPostgres(banco.clone())),
        conta: conta.clone(),
        catalogo: catalogo.clone(),
    };
    let segredo_do_relay = config.segredo_do_relay.as_ref().map(|s| Arc::new(s.clone().into_bytes()));
    let moderacao = ServicosDeModeracao {
        repositorio: Arc::new(ModeracaoPostgres(banco.clone())),
        relay: Arc::new(RelayHttp {
            http: http.clone(),
            url: config.url_do_relay.clone(),
            segredo: segredo_do_relay.clone(),
            relogio: conta.relogio.clone(),
        }),
        conta: conta.clone(),
        segredo: segredo_do_relay.clone(),
    };
    let presenca = ServicosDePresenca {
        conta: conta.clone(),
        moderacao: moderacao.clone(),
        segredo: segredo_do_relay,
        janelas: Default::default(),
    };
    iniciar_trabalhador(ServicosDoRejulgamento {
        fila: rejulgamento.clone(),
        cache: rejulgamento,
        fonte: encore,
        conta: conta.clone(),
        relogio,
    });
    if config.osu.is_none() {
        tracing::warn!("sem OSU_CLIENT_ID e OSU_CLIENT_SECRET: as partidas do Mania esperam na fila sem XP");
    }
    let servicos_do_mania = ServicosDoMania {
        repositorio: Arc::new(ManiaPostgres(banco.clone())),
        fonte: Arc::new(Osu::novo(
            http.clone(),
            config
                .osu
                .clone()
                .map(|(client_id, client_secret)| CredenciaisDoOsu { client_id, client_secret }),
        )),
        conta: conta.clone(),
        relogio: conta.relogio.clone(),
        gerador: conta.gerador.clone(),
    };
    mania::iniciar_trabalhador(servicos_do_mania.clone());
    let amizade = ServicosDeAmizade {
        repositorio: Arc::new(AmizadesPostgres(banco.clone())),
        conta: conta.clone(),
        janelas: Default::default(),
    };
    let estado = EstadoDoApp {
        amizade,
        banco: Arc::new(BancoPostgres(banco)),
        conta,
        ranking,
        perfil,
        presenca,
        moderacao,
        mania: servicos_do_mania,
    };
    let app = riffrush_api::app(estado, &config.origens_permitidas);

    let ouvinte = tokio::net::TcpListener::bind(config.endereco).await?;
    tracing::info!(endereco = %config.endereco, "API no ar");
    axum::serve(ouvinte, app)
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c().await.ok();
        })
        .await?;
    Ok(())
}
