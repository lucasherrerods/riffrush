use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::dominio::ChartGuardado;
use crate::modules::conta::FalhaExterna;
use crate::modules::progresso::{Dificuldade, Instrumento};

/// Uma partida que saiu da fila para ser rejulgada.
#[derive(Debug, Clone, PartialEq)]
pub struct PartidaPendente {
    pub id: Uuid,
    pub conta_id: Uuid,
    pub md5: String,
    pub dificuldade: Dificuldade,
    pub instrumento: Instrumento,
    pub replay: Vec<u8>,
    pub enviada_em: DateTime<Utc>,
    /// Já contando esta.
    pub tentativas: u32,
}

#[async_trait]
pub trait FilaDoRejulgamento: Send + Sync {
    /// Reserva até `limite` partidas na vez, das mais antigas para as mais novas. Uma reservada não sai
    /// para outro trabalhador por alguns minutos; se o servidor cair no meio, ela volta sozinha.
    async fn pegar(&self, limite: u32, agora: DateTime<Utc>) -> Result<Vec<PartidaPendente>, FalhaExterna>;
    async fn concluir(&self, id: Uuid) -> Result<(), FalhaExterna>;
    async fn reagendar(&self, id: Uuid, quando: DateTime<Utc>) -> Result<(), FalhaExterna>;
    /// A partida não tem como valer: fica guardada com o motivo, fora da vez.
    async fn desistir(&self, id: Uuid, motivo: &str) -> Result<(), FalhaExterna>;
}

#[async_trait]
pub trait CacheDeCharts: Send + Sync {
    async fn buscar(&self, md5: &str) -> Result<Option<ChartGuardado>, FalhaExterna>;
    async fn guardar(&self, md5: &str, chart: &ChartGuardado) -> Result<(), FalhaExterna>;
}

/// O que veio do download de um chart.
#[derive(Debug, Clone, PartialEq)]
pub enum ChartBaixado {
    Pronto(ChartGuardado),
    /// O Encore não tem esse md5.
    NaoExiste,
    /// O .sng veio, mas sem um chart que dê para ler.
    Ilegivel,
}

#[async_trait]
pub trait LimiteDePedidos: Send + Sync {
    /// Anota o pedido e devolve true se ele cabe no limite; sem espaço, não anota nada.
    async fn pedir(&self, agora: DateTime<Utc>) -> Result<bool, FalhaExterna>;
}

#[async_trait]
pub trait FonteDeCharts: Send + Sync {
    /// Baixa o .sng do chart guardando só o chart: o áudio passa sem ficar na memória.
    async fn baixar(&self, md5: &str) -> Result<ChartBaixado, FalhaExterna>;
}
