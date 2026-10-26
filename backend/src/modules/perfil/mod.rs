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
    montar_perfil, DadosDoPerfil, EstatisticasDaDificuldade, MusicaMaisTocada, PartidaRecente, PartidasNoInstrumento, Perfil, Recorde, MAIS_TOCADAS,
    PARTIDAS_RECENTES,
};
pub use http::{
    __path_perfil, __path_recordes, perfil, recordes, rotas, DadosDaMusicaNoPerfil, DificuldadeDoPerfil, InstrumentoDoPerfil, MusicaDoPerfil, PartidaDoPerfil,
    RecordeDaConta, RespostaDoPerfil,
};
pub use portas::RepositorioDoPerfil;
pub use postgres::PerfilPostgres;
