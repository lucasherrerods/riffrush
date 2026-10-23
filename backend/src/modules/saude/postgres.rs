use async_trait::async_trait;
use sqlx::PgPool;

use super::portas::VerificadorDoBanco;

pub struct BancoPostgres(pub PgPool);

#[async_trait]
impl VerificadorDoBanco for BancoPostgres {
    async fn responde(&self) -> bool {
        sqlx::query("SELECT 1").execute(&self.0).await.is_ok()
    }
}
