use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::dominio::{DadosDoPerfil, Recorde};
use super::imagem::{Imagem, TipoDeImagem};
use crate::modules::conta::FalhaExterna;

#[async_trait]
pub trait RepositorioDoPerfil: Send + Sync {
    /// As estatísticas da conta e as `recentes` partidas mais novas. `None` se a conta não existe.
    async fn dados(&self, conta_id: Uuid, recentes: u32) -> Result<Option<DadosDoPerfil>, FalhaExterna>;
    /// A melhor partida terminada de cada música, dificuldade e instrumento que a conta jogou.
    async fn recordes(&self, conta_id: Uuid) -> Result<Vec<Recorde>, FalhaExterna>;
    /// Guarda a imagem e passa a mostrar o `endereco` dela na conta (foto) ou no perfil (capa).
    async fn guardar_imagem(&self, conta_id: Uuid, tipo: TipoDeImagem, imagem: &Imagem, endereco: &str, agora: DateTime<Utc>) -> Result<(), FalhaExterna>;
    /// Sem foto própria, a conta volta para a do Google; sem capa, o perfil fica sem.
    async fn apagar_imagem(&self, conta_id: Uuid, tipo: TipoDeImagem) -> Result<(), FalhaExterna>;
    async fn imagem(&self, conta_id: Uuid, tipo: TipoDeImagem) -> Result<Option<Imagem>, FalhaExterna>;
    /// Quando a conta trocou alguma imagem pela última vez.
    async fn ultima_troca(&self, conta_id: Uuid) -> Result<Option<DateTime<Utc>>, FalhaExterna>;
}
