//! O motor da partida, no padrão do Clone Hero: o app roda em WASM e a API rejulga os replays com o mesmo código.
//! Os dois lados passam pelos mesmos casos em `tests/paridade.json`.

mod chart;
mod partida;
mod replay;

pub use chart::{
    extrair_chart, hash_do_chart, ler_chart, ler_midi, ler_sng, notas_do_chart, notas_do_sng, ritmo_do_chart, ChartGuardado, ChartLido, Dificuldade,
    ErroDoChart, ExtratorDeChart, Instrumento,
};
pub use partida::{
    acertar, ativar_estrela, avancar, criar_partida, criar_partida_com_ritmo, estrela, full_combo, julgar, multiplicador, palhetar, precisao, quantizar,
    retirar_eventos, soltar, tocar, Evento, JeitoDeJogar, Julgamento, Nota, NotaEmJogo, OpcoesDaPartida, Partida, Ritmo, TipoDaNota, JANELA_DE_ACERTO, JULGAMENTOS,
    PISTA_ABERTA, VELOCIDADES,
};
pub use replay::{aplicar_entradas, desempacotar_replay, empacotar_replay, versao_do_replay_conhecida, Entrada, ErroDoReplay, Replay, TipoDaEntrada};
