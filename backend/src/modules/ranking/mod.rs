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
pub use dominio::{
    juntar_mesmas_musicas, montar_ranking, LinhaDoGeral, LinhaDoRanking, MusicaPopular, Ordem, PartidaPublica, Posicionada, Ranking, RecordeDaMusica,
    TAMANHO_DO_TOP, TAMANHO_DO_TOP_DA_MUSICA,
};
pub use http::{
    __path_geral, __path_musicas, __path_partida, __path_ranking, __path_replay, geral, musicas, partida, ranking, replay, rotas, MusicaNoRanking,
    PartidaDoRanking, PosicaoNoGeral, PosicaoNoRanking, RecordeNoRanking, RespostaDoGeral, RespostaDoRanking,
};
pub use portas::RepositorioDoRanking;
pub use postgres::RankingPostgres;
