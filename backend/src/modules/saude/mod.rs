//! Módulo de exemplo da arquitetura: domínio puro, porta, caso de uso e dois adaptadores.

mod casos_de_uso;
mod dominio;
mod http;
mod portas;
mod postgres;

pub use http::{__path_saude, rotas, RespostaDeSaude};
pub use portas::VerificadorDoBanco;
pub use postgres::BancoPostgres;
