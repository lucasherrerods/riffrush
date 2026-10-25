//! O perfil de quem está logado: nível, estatísticas das partidas e as últimas jogadas.

mod casos_de_uso;
mod dominio;
mod http;
mod portas;
mod postgres;

#[cfg(any(test, feature = "testes"))]
pub use casos_de_uso::fakes;
pub use casos_de_uso::{ErroDoPerfil, ServicosDoPerfil};
pub use dominio::{
    montar_perfil, DadosDoPerfil, EstatisticasDaDificuldade, MusicaMaisTocada, PartidaRecente, PartidasNoInstrumento, Perfil, MAIS_TOCADAS, PARTIDAS_RECENTES,
};
pub use http::{
    __path_perfil, perfil, rotas, DadosDaMusicaNoPerfil, DificuldadeDoPerfil, InstrumentoDoPerfil, MusicaDoPerfil, PartidaDoPerfil, RespostaDoPerfil,
};
pub use portas::RepositorioDoPerfil;
pub use postgres::PerfilPostgres;
