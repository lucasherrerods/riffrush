use async_trait::async_trait;
use uuid::Uuid;

use super::dominio::Playlist;
use crate::modules::conta::FalhaExterna;

#[async_trait]
pub trait RepositorioDePlaylists: Send + Sync {
    /// As playlists da conta, da editada por último para trás.
    async fn da_conta(&self, conta_id: Uuid) -> Result<Vec<Playlist>, FalhaExterna>;
    /// Cria ou troca a playlist inteira. Devolve `false` se o id já é de outra conta.
    async fn guardar(&self, conta_id: Uuid, playlist: &Playlist) -> Result<bool, FalhaExterna>;
    /// Apagar uma que não existe, ou de outra conta, não faz nada.
    async fn apagar(&self, conta_id: Uuid, id: Uuid) -> Result<(), FalhaExterna>;
}
