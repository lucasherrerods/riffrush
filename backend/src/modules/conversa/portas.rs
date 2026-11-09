use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::dominio::{MensagemPrivada, NaoLidas, NovaMensagem, Remetente};
use crate::modules::conta::FalhaExterna;

#[async_trait]
pub trait RepositorioDeConversas: Send + Sync {
    async fn guardar(&self, mensagem: &NovaMensagem) -> Result<MensagemPrivada, FalhaExterna>;
    /// As mensagens entre `a` e `b`, as mais novas primeiro, só as de id menor que `antes` quando ele vem.
    async fn mensagens(&self, a: Uuid, b: Uuid, antes: Option<i64>, limite: u32) -> Result<Vec<MensagemPrivada>, FalhaExterna>;
    /// Marca como lidas as mensagens de `de` para `quem` que ainda não tinham sido lidas.
    async fn marcar_lidas(&self, quem: Uuid, de: Uuid, agora: DateTime<Utc>) -> Result<(), FalhaExterna>;
    /// Quantas mensagens esperam `quem` ler, por remetente.
    async fn nao_lidas(&self, quem: Uuid) -> Result<Vec<NaoLidas>, FalhaExterna>;
}

/// Entrega a mensagem na hora a quem está conectado. Quem não está vê pelo histórico.
#[async_trait]
pub trait EntregaNaHora: Send + Sync {
    async fn entregar(&self, mensagem: &MensagemPrivada, remetente: &Remetente) -> Result<(), FalhaExterna>;
}
