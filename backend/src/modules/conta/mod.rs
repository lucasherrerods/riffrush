//! Contas com login Google, sessões e o registro das partidas que dão XP.

mod casos_de_uso;
mod dominio;
mod google;
mod http;
mod portas;
mod postgres;
mod sistema;

#[cfg(any(test, feature = "testes"))]
pub use casos_de_uso::fakes;
pub use casos_de_uso::ServicosDaConta;
pub use dominio::{Conta, PerfilDoGoogle};
pub use google::Google;
pub use http::{
    __path_entrar, __path_eu, __path_registrar_partida, __path_sair, rotas, CorpoDaPartida, CorpoDoLogin, NivelDaConta, RespostaDaConta, RespostaDaPartida,
    RespostaDoLogin,
};
pub use portas::{ErroDeLogin, FalhaExterna, Gerador, PartidaRegistrada, PedidoDeLogin, ProvedorDeLogin, Relogio, RepositorioDeContas, RepositorioDeSessoes};
pub use postgres::ContasPostgres;
pub use sistema::{GeradorAleatorio, RelogioDoSistema};
