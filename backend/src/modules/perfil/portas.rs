use async_trait::async_trait;
use uuid::Uuid;

use super::dominio::{DadosDoPerfil, Recorde};
use crate::modules::conta::FalhaExterna;

#[async_trait]
pub trait RepositorioDoPerfil: Send + Sync {
    /// As estatísticas da conta e as `recentes` partidas mais novas. `None` se a conta não existe.
    async fn dados(&self, conta_id: Uuid, recentes: u32) -> Result<Option<DadosDoPerfil>, FalhaExterna>;
    /// A melhor partida terminada de cada música, dificuldade e instrumento que a conta jogou.
    async fn recordes(&self, conta_id: Uuid) -> Result<Vec<Recorde>, FalhaExterna>;
}
