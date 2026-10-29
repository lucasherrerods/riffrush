//! XP das partidas e nível da conta.

mod dominio;

pub use dominio::{
    nivel_do_xp, precisao_pelo_valor, xp_da_partida, xp_para_subir, xp_pelos_numeros, Dificuldade, Instrumento, JeitoDeJogar, Nivel, PartidaInvalida,
    ResumoDaPartida, MAXIMO_DE_NOTAS, MINIMO_DE_NOTAS_PARA_XP,
};
pub use dominio::{validar_replay, TAMANHO_MAXIMO_DO_REPLAY};
