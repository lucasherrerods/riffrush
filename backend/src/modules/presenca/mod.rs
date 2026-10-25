//! Quem está online: a API só assina uma ficha com quem a pessoa é; a lista fica no relay.

mod casos_de_uso;
mod dominio;
mod http;

pub use casos_de_uso::{ErroDaPresenca, ServicosDePresenca};
pub use dominio::{assinar_ficha, Ficha, VALIDADE_DA_FICHA_EM_SEGUNDOS};
pub use http::{__path_ficha, ficha, rotas, RespostaDaFicha};
