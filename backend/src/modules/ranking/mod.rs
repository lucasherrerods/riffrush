//! O ranking de cada música e dificuldade: a melhor partida de cada jogador, como no osu!.

mod casos_de_uso;
mod dominio;
mod http;
mod portas;
mod postgres;

#[cfg(any(test, feature = "testes"))]
pub use casos_de_uso::fakes;
pub use casos_de_uso::{ErroDoRanking, ServicosDoRanking};
pub use dominio::{montar_ranking, LinhaDoRanking, Ranking, TAMANHO_DO_TOP};
pub use http::{__path_ranking, ranking, rotas, PosicaoNoRanking, RespostaDoRanking};
pub use portas::RepositorioDoRanking;
pub use postgres::RankingPostgres;
