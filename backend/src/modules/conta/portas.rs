use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::dominio::{Conta, PerfilDoGoogle};
use crate::modules::progresso::ResumoDaPartida;

/// Algo de fora (banco, Google) falhou. O detalhe vai só para o log.
#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub struct FalhaExterna(pub String);

pub struct PartidaRegistrada {
    pub conta_id: Uuid,
    pub musica_id: String,
    pub pontos: u64,
    pub resumo: ResumoDaPartida,
    pub xp_ganho: u64,
    pub jogada_em: DateTime<Utc>,
}

#[async_trait]
pub trait RepositorioDeContas: Send + Sync {
    /// Primeiro login cria a conta; os seguintes atualizam nome e foto.
    async fn entrar(&self, perfil: &PerfilDoGoogle, novo_id: Uuid) -> Result<Conta, FalhaExterna>;
    async fn buscar(&self, id: Uuid) -> Result<Option<Conta>, FalhaExterna>;
    async fn ultima_partida(&self, conta_id: Uuid) -> Result<Option<DateTime<Utc>>, FalhaExterna>;
    /// Guarda a partida e soma o XP na mesma transação; devolve a conta atualizada.
    async fn registrar_partida(&self, partida: &PartidaRegistrada) -> Result<Conta, FalhaExterna>;
}

#[async_trait]
pub trait RepositorioDeSessoes: Send + Sync {
    async fn criar(&self, token_hash: &str, conta_id: Uuid, expira_em: DateTime<Utc>) -> Result<(), FalhaExterna>;
    async fn conta_da_sessao(&self, token_hash: &str, agora: DateTime<Utc>) -> Result<Option<Uuid>, FalhaExterna>;
    async fn apagar(&self, token_hash: &str) -> Result<(), FalhaExterna>;
}

pub struct PedidoDeLogin {
    pub codigo: String,
    /// O verificador do PKCE: prova que quem troca o código é quem começou o login.
    pub verificador: String,
    pub redirect_uri: String,
}

#[derive(Debug, thiserror::Error)]
pub enum ErroDeLogin {
    #[error("o Google recusou o login")]
    Recusado,
    #[error(transparent)]
    Falha(#[from] FalhaExterna),
}

#[async_trait]
pub trait ProvedorDeLogin: Send + Sync {
    async fn trocar_codigo(&self, pedido: &PedidoDeLogin) -> Result<PerfilDoGoogle, ErroDeLogin>;
}

pub trait Relogio: Send + Sync {
    fn agora(&self) -> DateTime<Utc>;
}

pub trait Gerador: Send + Sync {
    fn id(&self) -> Uuid;
    fn token(&self) -> String;
}
