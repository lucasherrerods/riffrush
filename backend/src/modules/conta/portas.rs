use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::dominio::{Conta, PerfilDoGoogle};
use crate::modules::progresso::{Dificuldade, Instrumento, JeitoDeJogar, ResumoDaPartida};

/// Algo de fora (banco, Google) falhou. O detalhe vai só para o log.
#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub struct FalhaExterna(pub String);

pub struct PartidaRegistrada {
    pub id: Uuid,
    pub conta_id: Uuid,
    pub musica_id: String,
    pub instrumento: Instrumento,
    pub pontos: u64,
    pub resumo: ResumoDaPartida,
    pub xp_ganho: u64,
    pub jogada_em: DateTime<Utc>,
    /// Só vem em partida que vale para o ranking.
    pub replay: Option<Vec<u8>>,
    /// Só as partidas que o servidor rejulgou têm, e só elas entram no ranking.
    pub precisao: Option<f64>,
    /// Só as partidas que o servidor rejulgou sabem: vem do replay.
    pub jeito_de_jogar: Option<JeitoDeJogar>,
}

/// Uma partida de chart do Encore à espera do servidor rejulgar o replay.
pub struct PartidaNaFila {
    pub id: Uuid,
    pub conta_id: Uuid,
    pub md5: String,
    pub dificuldade: Dificuldade,
    pub instrumento: Instrumento,
    pub replay: Vec<u8>,
    pub enviada_em: DateTime<Utc>,
}

#[async_trait]
pub trait FilaDePartidas: Send + Sync {
    async fn enfileirar(&self, partida: PartidaNaFila) -> Result<(), FalhaExterna>;
}

/// Uma partida enviada, do jeito que o banco a guarda agora.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PartidaGuardada {
    Registrada {
        xp_ganho: u64,
    },
    NaFila,
    /// O rejulgamento desistiu dela (replay de outro chart, chart sumiu do Encore).
    Recusada,
}

#[async_trait]
pub trait RepositorioDeContas: Send + Sync {
    /// Primeiro login cria a conta; os seguintes atualizam nome e foto.
    async fn entrar(&self, perfil: &PerfilDoGoogle, novo_id: Uuid) -> Result<Conta, FalhaExterna>;
    async fn buscar(&self, id: Uuid) -> Result<Option<Conta>, FalhaExterna>;
    /// A partida mais recente, contando as que ainda esperam na fila.
    async fn ultima_partida(&self, conta_id: Uuid) -> Result<Option<DateTime<Utc>>, FalhaExterna>;
    /// Guarda a partida e soma o XP na mesma transação; devolve a conta atualizada.
    /// Uma partida com um id que já existe não muda nada: a fila pode entregar a mesma duas vezes.
    async fn registrar_partida(&self, partida: &PartidaRegistrada) -> Result<Conta, FalhaExterna>;
    /// Quantas partidas a conta registrou no chart desde `desde`, sem contar a `exceto`.
    async fn partidas_no_chart(&self, conta_id: Uuid, musica_id: &str, desde: DateTime<Utc>, exceto: Uuid) -> Result<u32, FalhaExterna>;
    /// Em que pé está uma partida da conta: registrada (com o XP), ainda na fila ou recusada. `None` se não for dela.
    async fn situacao_da_partida(&self, conta_id: Uuid, id: Uuid) -> Result<Option<PartidaGuardada>, FalhaExterna>;
    /// Apaga a conta junto com as sessões e as partidas dela.
    async fn excluir(&self, id: Uuid) -> Result<(), FalhaExterna>;
}

#[async_trait]
pub trait RepositorioDeSessoes: Send + Sync {
    async fn criar(&self, token_hash: &str, conta_id: Uuid, expira_em: DateTime<Utc>) -> Result<(), FalhaExterna>;
    async fn conta_da_sessao(&self, token_hash: &str, agora: DateTime<Utc>) -> Result<Option<Uuid>, FalhaExterna>;
    async fn apagar(&self, token_hash: &str) -> Result<(), FalhaExterna>;
}

/// O Google tem um client id para a web e outro para o desktop, que aceita qualquer porta no loopback.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClienteDoGoogle {
    #[default]
    Web,
    Desktop,
}

pub struct PedidoDeLogin {
    pub codigo: String,
    /// O verificador do PKCE: prova que quem troca o código é quem começou o login.
    pub verificador: String,
    pub redirect_uri: String,
    pub cliente: ClienteDoGoogle,
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
