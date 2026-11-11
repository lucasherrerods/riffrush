use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::dominio::{ChartGuardado, Rejulgada};
use super::estimativa::PesosAntigos;
use crate::modules::conta::FalhaExterna;
use crate::modules::progresso::{Dificuldade, Instrumento, ResumoDaPartida};

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
    pub rodada: Option<Uuid>,
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

/// Uma partida julgada com as regras de antes das do Clone Hero, com o replay guardado para rejulgar.
#[derive(Debug, Clone, PartialEq)]
pub struct PartidaAntiga {
    pub id: Uuid,
    pub md5: String,
    pub dificuldade: Dificuldade,
    pub instrumento: Instrumento,
    pub replay: Vec<u8>,
}

#[async_trait]
pub trait PartidasAntigas: Send + Sync {
    /// Até `limite` partidas que ainda têm as regras antigas, das mais velhas para as mais novas.
    async fn pegar_antigas(&self, limite: u32) -> Result<Vec<PartidaAntiga>, FalhaExterna>;
    /// Troca os números da partida pelos das regras novas. O XP que ela rendeu fica como está.
    async fn atualizar(&self, id: Uuid, rejulgada: &Rejulgada) -> Result<(), FalhaExterna>;
    /// Não há como rejulgar: a partida fica com as regras antigas, fora do ranking.
    async fn sem_como_rejulgar(&self, id: Uuid) -> Result<(), FalhaExterna>;
}

/// Uma partida do Encore julgada antes do ScoreV1, para passar para ele.
#[derive(Debug, Clone, PartialEq)]
pub struct PartidaDoJulgamentoAntigo {
    pub id: Uuid,
    pub conta_id: Uuid,
    pub md5: String,
    pub dificuldade: Dificuldade,
    pub instrumento: Instrumento,
    /// Só os recordes guardam o replay; sem ele, a precisão é estimada.
    pub replay: Option<Vec<u8>>,
    pub resumo: ResumoDaPartida,
    pub pesos: PesosAntigos,
    /// Desistência que nunca rendeu XP (o app não manda o replay dela) continua sem.
    pub rendia_xp: bool,
    /// Quantas vezes a conta jogou o mesmo chart nas 24 horas antes desta, como no XP de hoje.
    pub repeticoes: u32,
}

/// A partida no ScoreV1: rejulgada pelo replay ou estimada pelo valor guardado.
#[derive(Debug, Clone, PartialEq)]
pub enum NoScoreV1 {
    Rejulgada(Rejulgada),
    Estimada { valor_dos_acertos: u32, precisao: f64 },
}

#[async_trait]
pub trait PartidasDoJulgamentoAntigo: Send + Sync {
    /// Até `limite` partidas ainda julgadas antes do ScoreV1, das mais velhas para as mais novas.
    async fn pegar_do_julgamento_antigo(&self, limite: u32) -> Result<Vec<PartidaDoJulgamentoAntigo>, FalhaExterna>;
    /// Grava a partida no ScoreV1 com o XP refeito e soma de novo o XP da conta pelas partidas dela.
    async fn gravar_no_score_v1(&self, partida: &PartidaDoJulgamentoAntigo, nova: &NoScoreV1, xp_ganho: u64) -> Result<(), FalhaExterna>;
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
