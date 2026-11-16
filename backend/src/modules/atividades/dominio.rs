use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::modules::progresso::{Dificuldade, Instrumento};

/// Quantas atividades vêm sem pedir um número.
pub const LIMITE_PADRAO: u32 = 50;
/// O máximo por pedido; para ver mais, pede-se de novo com `antes`.
pub const LIMITE_MAXIMO: u32 = 100;

/// O que aconteceu.
#[derive(Debug, Clone, PartialEq)]
pub enum Evento {
    PartidaDoRock {
        musica_id: String,
        /// Do catálogo; sem ele, o app mostra o que tiver.
        titulo: Option<String>,
        artista: Option<String>,
        instrumento: Instrumento,
        dificuldade: Dificuldade,
        precisao: Option<f64>,
        derrota: bool,
    },
    PartidaDoMania {
        beatmap_id: u64,
        beatmapset_id: Option<u64>,
        /// Do .osu que o servidor guardou.
        titulo: Option<String>,
        artista: Option<String>,
        dificuldade: Option<String>,
        precisao: f64,
        derrota: bool,
    },
    ContaNova,
}

/// Quem fez o quê e quando.
#[derive(Debug, Clone, PartialEq)]
pub struct Atividade {
    pub conta_id: Uuid,
    pub nome: String,
    pub avatar: Option<String>,
    pub quando: DateTime<Utc>,
    pub evento: Evento,
}

/// O número pedido, dentro dos limites; sem número, o padrão.
pub fn limite_do_pedido(pedido: Option<u32>) -> u32 {
    pedido.unwrap_or(LIMITE_PADRAO).clamp(1, LIMITE_MAXIMO)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn o_limite_tem_padrao_e_fica_entre_1_e_o_maximo() {
        assert_eq!(limite_do_pedido(None), LIMITE_PADRAO);
        assert_eq!(limite_do_pedido(Some(0)), 1);
        assert_eq!(limite_do_pedido(Some(20)), 20);
        assert_eq!(limite_do_pedido(Some(10_000)), LIMITE_MAXIMO);
    }
}
