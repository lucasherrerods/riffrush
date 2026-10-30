use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::dominio::{Contagens, Pessoa, Relacao, Sugestao};
use crate::modules::conta::FalhaExterna;

#[async_trait]
pub trait RepositorioDeAmizades: Send + Sync {
    async fn codigo(&self, conta_id: Uuid) -> Result<Option<String>, FalhaExterna>;
    /// Guarda o código se a conta ainda não tem um e devolve o código dela.
    /// `None` quando o código já é de outra conta: aí quem chama sorteia outro.
    async fn guardar_codigo(&self, conta_id: Uuid, codigo: &str) -> Result<Option<String>, FalhaExterna>;
    async fn conta_do_codigo(&self, codigo: &str) -> Result<Option<Uuid>, FalhaExterna>;
    async fn marcar_visto(&self, conta_id: Uuid, agora: DateTime<Utc>) -> Result<(), FalhaExterna>;
    /// Como `quem` está ligado a `outro`, olhando de `quem`.
    async fn relacao(&self, quem: Uuid, outro: Uuid) -> Result<Relacao, FalhaExterna>;
    async fn contagens(&self, quem: Uuid, outro: Uuid) -> Result<Contagens, FalhaExterna>;
    /// Um pedido que já existe, nos dois sentidos, não muda nada.
    async fn criar_pedido(&self, de: Uuid, para: Uuid, agora: DateTime<Utc>) -> Result<(), FalhaExterna>;
    /// `false` quando não há pedido de `solicitante` para `destinatario` esperando.
    async fn aceitar(&self, solicitante: Uuid, destinatario: Uuid, agora: DateTime<Utc>) -> Result<bool, FalhaExterna>;
    /// Desfaz amizade ou pedido entre os dois, venha de quem vier.
    async fn desfazer(&self, a: Uuid, b: Uuid) -> Result<(), FalhaExterna>;
    /// Bloqueia e desfaz o que houvesse entre os dois.
    async fn bloquear(&self, quem: Uuid, outro: Uuid, agora: DateTime<Utc>) -> Result<(), FalhaExterna>;
    async fn desbloquear(&self, quem: Uuid, outro: Uuid) -> Result<(), FalhaExterna>;
    /// Amigos, pedidos recebidos, enviados e bloqueados da conta.
    async fn pessoas(&self, conta_id: Uuid) -> Result<Vec<Pessoa>, FalhaExterna>;
    /// Amigos de amigos, os com mais amigos em comum primeiro, sem quem já tem vínculo nem bloqueio.
    async fn sugestoes(&self, conta_id: Uuid, limite: u32) -> Result<Vec<Sugestao>, FalhaExterna>;
}
