//! O motor da partida: as mesmas regras do `partida.ts` do app, para o servidor rejulgar replays.
//! Os dois lados passam pelos mesmos casos em `tests/paridade.json`.

mod chart;
mod partida;
mod replay;

pub use chart::{
    extrair_chart, hash_do_chart, ler_chart, ler_midi, ler_sng, notas_do_chart, notas_do_sng, ChartGuardado, ChartLido, Dificuldade, ErroDoChart,
    ExtratorDeChart, Instrumento,
};
pub use partida::{
    acertar, ativar_estrela, avancar, criar_partida, estrela, julgar, multiplicador, palhetar, precisao, quantizar, retirar_eventos, soltar, tocar, Evento,
    JeitoDeJogar, Julgamento, Nota, NotaEmJogo, OpcoesDaPartida, Partida, JANELA_DE_ACERTO, PISTA_ABERTA, VELOCIDADES,
};
pub use replay::{aplicar_entradas, desempacotar_replay, empacotar_replay, Entrada, ErroDoReplay, Replay, TipoDaEntrada};
