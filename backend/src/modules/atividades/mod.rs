//! O log do que a galera anda fazendo: as partidas do Rock e do Mania e as contas novas, da mais recente para trás.

mod casos_de_uso;
mod dominio;
mod http;
mod portas;
mod postgres;

#[cfg(any(test, feature = "testes"))]
pub use casos_de_uso::fakes;
pub use casos_de_uso::ServicosDeAtividades;
pub use dominio::{limite_do_pedido, Atividade, Evento, LIMITE_MAXIMO, LIMITE_PADRAO};
pub use http::{__path_atividades, atividades, rotas, AtividadeNaResposta, EventoNaResposta};
pub use portas::RepositorioDeAtividades;
pub use postgres::AtividadesPostgres;
