//! Playlists dos jogadores, nos dois modos: guardadas na conta e visíveis no perfil para os amigos.

mod casos_de_uso;
mod dominio;
mod http;
mod portas;
mod postgres;

#[cfg(any(test, feature = "testes"))]
pub use casos_de_uso::fakes;
pub use casos_de_uso::{ErroDasPlaylists, ServicosDePlaylists};
pub use dominio::{Faixa, ModoDaPlaylist, Playlist, PlaylistInvalida, MAXIMO_DE_FAIXAS, MAXIMO_DE_PLAYLISTS};
pub use http::{
    __path_apagar, __path_do_amigo, __path_guardar, __path_minhas, apagar, do_amigo, guardar, minhas, rotas, FaixaDaPlaylist, PedidoDePlaylist,
    PlaylistNaResposta,
};
pub use portas::RepositorioDePlaylists;
pub use postgres::PlaylistsPostgres;
