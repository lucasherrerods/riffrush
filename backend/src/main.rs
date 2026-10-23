use std::sync::Arc;

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

    let estado = EstadoDoApp {
        banco: Arc::new(BancoPostgres(banco)),
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
