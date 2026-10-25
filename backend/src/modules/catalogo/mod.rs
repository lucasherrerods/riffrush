//! Nome, banda e capa das músicas, a partir do id que as partidas guardam.

mod casos_de_uso;
mod dominio;
mod encore;
mod portas;
mod postgres;

#[cfg(any(test, feature = "testes"))]
pub use casos_de_uso::fakes;
pub use casos_de_uso::ServicosDoCatalogo;
pub use dominio::{origem_do_id, DadosDaMusica, Origem, CONSULTAS_POR_PEDIDO};
pub use encore::Encore;
pub use portas::{FonteDeMusicas, RepositorioDoCatalogo};
pub use postgres::CatalogoPostgres;
