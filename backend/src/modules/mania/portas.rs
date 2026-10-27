use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::modules::conta::FalhaExterna;

/// Uma partida do Mania enviada pelo app, à espera do servidor rejulgar o replay.
#[derive(Debug, Clone, PartialEq)]
pub struct PartidaNaFila {
    pub id: Uuid,
    pub conta_id: Uuid,
    pub beatmap_id: u64,
    pub replay: Vec<u8>,
    pub enviada_em: DateTime<Utc>,
}

/// Uma partida que saiu da fila para ser rejulgada.
#[derive(Debug, Clone, PartialEq)]
pub struct PartidaPendente {
    pub partida: PartidaNaFila,
    /// Já contando esta.
    pub tentativas: u32,
}

/// O .osu de uma dificuldade e o que o osu! diz dela.
#[derive(Debug, Clone, PartialEq)]
pub struct BeatmapDoOsu {
    pub beatmap_id: u64,
    pub beatmapset_id: Option<u64>,
    pub md5: String,
    /// ranked, approved, loved, qualified, pending, graveyard…
    pub status: String,
    pub estrelas: f64,
    pub texto: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum BeatmapBaixado {
    Pronto(BeatmapDoOsu),
    NaoExiste,
    /// A dificuldade é de outro modo do osu!.
    NaoEhMania,
}

/// Uma partida rejulgada, pronta para entrar na conta.
#[derive(Debug, Clone, PartialEq)]
pub struct PartidaRegistrada {
    pub id: Uuid,
    pub conta_id: Uuid,
    pub beatmap_id: u64,
    pub beatmapset_id: Option<u64>,
    pub pontuacao: u32,
    pub precisao: f64,
    pub contagem: [u32; 6],
    pub maior_combo: u32,
    pub derrota: bool,
    pub mods: u32,
    pub xp_ganho: u64,
    pub vale_ranking: bool,
    /// Só fica guardado o replay das partidas que entram no ranking.
    pub replay: Option<Vec<u8>>,
    pub jogada_em: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PartidaGuardada {
    Registrada { xp_ganho: u64 },
    NaFila,
    Recusada,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LinhaDoRanking {
    pub posicao: u32,
    pub partida_id: Uuid,
    pub conta_id: Uuid,
    pub nome: String,
    pub avatar: Option<String>,
    pub pontuacao: u32,
    pub precisao: f64,
    pub maior_combo: u32,
    pub mods: u32,
    pub jogada_em: DateTime<Utc>,
}

#[async_trait]
pub trait RepositorioDoMania: Send + Sync {
    async fn enfileirar(&self, partida: &PartidaNaFila) -> Result<(), FalhaExterna>;
    /// A partida do Mania mais recente da conta, contando as que esperam na fila.
    async fn ultima_partida(&self, conta_id: Uuid) -> Result<Option<DateTime<Utc>>, FalhaExterna>;
    /// Reserva até `limite` partidas na vez, das mais antigas para as mais novas. Uma reservada não sai para
    /// outro trabalhador por alguns minutos; se o servidor cair no meio, ela volta sozinha.
    async fn pegar(&self, limite: u32, agora: DateTime<Utc>) -> Result<Vec<PartidaPendente>, FalhaExterna>;
    async fn reagendar(&self, id: Uuid, quando: DateTime<Utc>) -> Result<(), FalhaExterna>;
    /// A partida não tem como valer: fica guardada com o motivo, fora da vez.
    async fn desistir(&self, id: Uuid, motivo: &str) -> Result<(), FalhaExterna>;
    /// Guarda a partida, soma o XP na conta e tira a partida da fila, tudo na mesma transação.
    /// Um id que já existe não muda nada: a fila pode entregar a mesma partida duas vezes.
    async fn registrar(&self, partida: &PartidaRegistrada) -> Result<(), FalhaExterna>;
    /// Quantas partidas a conta registrou no mapa desde `desde`, sem contar a `exceto`.
    async fn partidas_no_mapa(&self, conta_id: Uuid, beatmap_id: u64, desde: DateTime<Utc>, exceto: Uuid) -> Result<u32, FalhaExterna>;
    async fn situacao(&self, conta_id: Uuid, id: Uuid) -> Result<Option<PartidaGuardada>, FalhaExterna>;
    /// O melhor de cada jogador no mapa, pela pontuação (empate: quem fez primeiro). A linha da `conta`, se ela
    /// está fora das primeiras, vem no fim com a posição dela.
    async fn ranking(&self, beatmap_id: u64, limite: u32, conta: Option<Uuid>) -> Result<Vec<LinhaDoRanking>, FalhaExterna>;
    /// O replay de uma partida do ranking.
    async fn replay(&self, partida_id: Uuid) -> Result<Option<Vec<u8>>, FalhaExterna>;
    async fn beatmap(&self, beatmap_id: u64) -> Result<Option<BeatmapDoOsu>, FalhaExterna>;
    async fn guardar_beatmap(&self, beatmap: &BeatmapDoOsu) -> Result<(), FalhaExterna>;
    /// Anota um pedido ao osu! e devolve true se ele cabe no limite; sem espaço, não anota nada.
    async fn pedir_ao_osu(&self, agora: DateTime<Utc>) -> Result<bool, FalhaExterna>;
}

#[async_trait]
pub trait FonteDeBeatmaps: Send + Sync {
    /// Baixa o .osu e o status da dificuldade no osu!.
    async fn baixar(&self, beatmap_id: u64) -> Result<BeatmapBaixado, FalhaExterna>;
}
