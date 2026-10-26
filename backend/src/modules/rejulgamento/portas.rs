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

#[async_trait]
pub trait FonteDeCharts: Send + Sync {
    /// O .sng do chart, ou None se ele não existe lá.
    async fn baixar(&self, md5: &str) -> Result<Option<Vec<u8>>, FalhaExterna>;
}
