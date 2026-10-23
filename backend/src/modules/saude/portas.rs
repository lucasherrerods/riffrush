use async_trait::async_trait;

#[async_trait]
pub trait VerificadorDoBanco: Send + Sync {
    async fn responde(&self) -> bool;
}
