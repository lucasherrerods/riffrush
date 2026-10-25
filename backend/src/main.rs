use std::sync::Arc;

use riffrush_api::modules::catalogo::{CatalogoPostgres, Encore, ServicosDoCatalogo};
use riffrush_api::modules::conta::{ContasPostgres, CredenciaisDoGoogle, GeradorAleatorio, Google, RelogioDoSistema, ServicosDaConta};
use riffrush_api::modules::perfil::{PerfilPostgres, ServicosDoPerfil};
use riffrush_api::modules::presenca::ServicosDePresenca;
use riffrush_api::modules::ranking::{RankingPostgres, ServicosDoRanking};
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
    let banco = PgPoolOptions::new().max_connections(5).connect(&config.url_do_banco).await?;
    sqlx::migrate!("./migrations").run(&banco).await?;

    let contas = Arc::new(ContasPostgres(banco.clone()));
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
            http: reqwest::Client::new(),
        }),
        relogio: Arc::new(RelogioDoSistema),
        gerador: Arc::new(GeradorAleatorio),
    };
    let catalogo = ServicosDoCatalogo {
        repositorio: Arc::new(CatalogoPostgres(banco.clone())),
        encore: Arc::new(Encore { http: reqwest::Client::new() }),
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
    let presenca = ServicosDePresenca {
        conta: conta.clone(),
        segredo: config.segredo_do_relay.as_ref().map(|s| Arc::new(s.clone().into_bytes())),
        janelas: Default::default(),
    };
    let estado = EstadoDoApp {
        banco: Arc::new(BancoPostgres(banco)),
        conta,
        ranking,
        perfil,
        presenca,
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
