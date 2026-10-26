//! As partidas de músicas do Encore: o servidor baixa o chart, toca o replay com o motor e só então dá o XP.
//! A partida espera numa fila no banco, então o Encore fora do ar atrasa o XP, mas não perde nada.

mod casos_de_uso;
mod dominio;
mod portas;
mod postgres;

use std::time::Duration;

pub use casos_de_uso::{Desfecho, ServicosDoRejulgamento};
pub use dominio::{espera_da_tentativa, rejulgar, ChartGuardado, JanelaDePedidos, Recusa, Rejulgada, JANELA_DO_ENCORE, PEDIDOS_AO_ENCORE};
pub use portas::{CacheDeCharts, FilaDoRejulgamento, FonteDeCharts, PartidaPendente};
pub use postgres::RejulgamentoPostgres;

/// Sem nada na fila, espera um pouco antes de olhar de novo.
const PAUSA_COM_A_FILA_VAZIA: Duration = Duration::from_secs(2);
const PAUSA_DEPOIS_DE_FALHA: Duration = Duration::from_secs(10);

/// Roda o rejulgamento em segundo plano enquanto a API estiver no ar.
pub fn iniciar_trabalhador(servicos: ServicosDoRejulgamento) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            match servicos.processar_lote().await {
                Ok(desfechos) if desfechos.is_empty() => tokio::time::sleep(PAUSA_COM_A_FILA_VAZIA).await,
                Ok(_) => {}
                Err(falha) => {
                    tracing::warn!(%falha, "a fila do rejulgamento falhou");
                    tokio::time::sleep(PAUSA_DEPOIS_DE_FALHA).await;
                }
            }
        }
    })
}
