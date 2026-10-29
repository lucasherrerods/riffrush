//! O Riff Rush Mania no servidor: as partidas dos mapas do osu!mania são rejulgadas contra o .osu oficial antes
//! de dar XP e entrar no ranking. Fila, cache e ranking são próprios, separados dos do Rock.

mod casos_de_uso;
mod dominio;
mod http;
mod osu;
mod portas;
mod postgres;

use std::time::Duration;

#[cfg(any(test, feature = "testes"))]
pub use casos_de_uso::fakes;
pub use casos_de_uso::{Desfecho, ErroDoMania, ServicosDoMania, Situacao};
pub use dominio::{rejulgar, status_vale_xp, xp_do_mania, Recusa, Rejulgada};
pub use http::{
    __path_enviar_partida, __path_ranking, __path_replay, __path_situacao_da_partida, rotas, CorpoDaPartidaDoMania, PosicaoNoRankingDoMania,
    RespostaDaPartidaDoManiaNaFila, RespostaDoRankingDoMania, SituacaoDaPartidaDoMania, XpDaPartidaDoMania,
};
pub use osu::{CredenciaisDoOsu, Osu};
pub use portas::{
    BeatmapBaixado, BeatmapDoOsu, FonteDeBeatmaps, LinhaDoRanking, PartidaGuardada, PartidaNaFila, PartidaPendente, PartidaRegistrada, RepositorioDoMania,
};
pub use postgres::ManiaPostgres;

const PAUSA_COM_A_FILA_VAZIA: Duration = Duration::from_secs(2);
const PAUSA_DEPOIS_DE_FALHA: Duration = Duration::from_secs(10);

/// Roda o rejulgamento do Mania em segundo plano enquanto a API estiver no ar.
pub fn iniciar_trabalhador(servicos: ServicosDoMania) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            match servicos.processar_lote().await {
                Ok(desfechos) if desfechos.is_empty() => tokio::time::sleep(PAUSA_COM_A_FILA_VAZIA).await,
                Ok(_) => {}
                Err(falha) => {
                    tracing::warn!(%falha, "a fila do Mania falhou");
                    tokio::time::sleep(PAUSA_DEPOIS_DE_FALHA).await;
                }
            }
        }
    })
}
