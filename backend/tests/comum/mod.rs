//! O que os testes do Postgres dividem.

use sqlx::PgPool;
use tokio::sync::OnceCell;

static MIGRADO: OnceCell<()> = OnceCell::const_new();

/// O banco do `DATABASE_URL`, com as migrações aplicadas uma vez só.
/// Os testes de um arquivo rodam em paralelo: migrar em cada um faz dois gravarem a mesma versão num banco vazio.
pub async fn banco_migrado() -> Option<PgPool> {
    let url = std::env::var("DATABASE_URL").ok()?;
    let pool = PgPool::connect(&url).await.expect("o DATABASE_URL não conecta");
    MIGRADO
        .get_or_init(|| async { sqlx::migrate!("./migrations").run(&pool).await.expect("as migrações falharam") })
        .await;
    Some(pool)
}
