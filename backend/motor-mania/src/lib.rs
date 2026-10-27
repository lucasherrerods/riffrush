//! O motor do Riff Rush Mania: lê beatmaps do modo mania do osu! (`.osu`) e, nas próximas fases, julga a partida.
//! É um crate à parte do motor do Rock: uma mudança aqui não mexe nas regras do outro jogo.

mod beatmap;

pub use beatmap::{hash_do_beatmap, ler_beatmap, Beatmap, Dificuldade, ErroDoBeatmap, Geral, Metadados, Nota, PontoDeTempo, MAXIMO_DE_TECLAS};
