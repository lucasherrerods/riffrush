use async_trait::async_trait;
use uuid::Uuid;

use super::dominio::{Banido, Denuncia, DenunciaRecebida, Situacao};
use crate::modules::conta::FalhaExterna;

#[async_trait]
pub trait RepositorioDeModeracao: Send + Sync {
    async fn situacao(&self, conta_id: Uuid) -> Result<Situacao, FalhaExterna>;
    /// A mesma pessoa denunciando a mesma mensagem de novo não conta duas vezes.
    async fn registrar_denuncia(&self, denuncia: &Denuncia) -> Result<(), FalhaExterna>;
    /// As mais novas primeiro.
    async fn denuncias(&self, limite: u32) -> Result<Vec<DenunciaRecebida>, FalhaExterna>;
    /// Tira todas as denúncias da mensagem `n`.
    async fn resolver(&self, mensagem_n: i64) -> Result<(), FalhaExterna>;
    /// `false` quando a conta não existe.
    async fn banir(&self, conta_id: Uuid, por: Uuid) -> Result<bool, FalhaExterna>;
    async fn desbanir(&self, conta_id: Uuid) -> Result<(), FalhaExterna>;
    async fn banidos(&self) -> Result<Vec<Banido>, FalhaExterna>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AvisoDeModeracao {
    Banir(Uuid),
    Desbanir(Uuid),
}

/// Avisa o relay na hora, para quem já está conectado ao chat: a ficha só muda na próxima conexão.
#[async_trait]
pub trait AvisoAoRelay: Send + Sync {
    async fn avisar(&self, aviso: AvisoDeModeracao) -> Result<(), FalhaExterna>;
}
