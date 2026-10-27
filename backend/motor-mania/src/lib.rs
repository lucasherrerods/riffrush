//! O motor do Riff Rush Mania: lê beatmaps do modo mania do osu! (`.osu`) e, nas próximas fases, julga a partida.
//! É um crate à parte do motor do Rock: uma mudança aqui não mexe nas regras do outro jogo.

mod beatmap;
mod mods;
mod partida;
mod replay;

pub use beatmap::{hash_do_beatmap, ler_beatmap, Beatmap, Dificuldade, ErroDoBeatmap, Geral, Metadados, Nota, PontoDeTempo, MAXIMO_DE_TECLAS};
pub use mods::{colunas_com_mods, ErroDosMods, Mods};
pub use partida::{
    avancar, classificacao, criar_partida, pontuacao, precisao, retirar_eventos, soltar, terminou, tocar, total_de_julgamentos, Classificacao, Evento, Janelas,
    Julgamento, OpcoesDaPartida, Partida, FATOR_DA_PONTA,
};
pub use replay::{desempacotar_replay, empacotar_replay, jogar_replay, Entrada, ErroDoReplay, Replay, MAXIMO_DE_ENTRADAS, VERSAO_DO_REPLAY};
