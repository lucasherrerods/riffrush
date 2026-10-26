//! O motor da partida: as mesmas regras do `partida.ts` do app, para o servidor rejulgar replays.
//! Os dois lados passam pelos mesmos casos em `tests/paridade.json`.

mod partida;
mod replay;

pub use partida::{
    ativar_estrela, avancar, criar_partida, julgar, precisao, quantizar, soltar, tocar, Julgamento, Nota, NotaEmJogo, OpcoesDaPartida, Partida,
    JANELA_DE_ACERTO, PISTA_ABERTA,
};
pub use replay::{aplicar_entradas, desempacotar_replay, Entrada, ErroDoReplay, Replay, TipoDaEntrada};
