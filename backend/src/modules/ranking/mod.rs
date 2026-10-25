//! O ranking de cada música e dificuldade (a melhor partida de cada jogador, como no osu!)
//! o ranking geral, pelo XP total das contas, e as músicas mais jogadas.

mod casos_de_uso;
mod dominio;
mod http;
mod portas;
mod postgres;

#[cfg(any(test, feature = "testes"))]
pub use casos_de_uso::fakes;
pub use casos_de_uso::{ErroDoRanking, ServicosDoRanking};
pub use dominio::{montar_ranking, LinhaDoGeral, LinhaDoRanking, MusicaPopular, Posicionada, Ranking, TAMANHO_DO_TOP};
pub use http::{
    __path_geral, __path_musicas, __path_ranking, geral, musicas, ranking, rotas, MusicaNoRanking, PosicaoNoGeral, PosicaoNoRanking, RespostaDoGeral,
    RespostaDoRanking,
};
pub use portas::RepositorioDoRanking;
pub use postgres::RankingPostgres;
