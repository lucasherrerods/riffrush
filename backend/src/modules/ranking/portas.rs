use async_trait::async_trait;
use uuid::Uuid;

use super::dominio::LinhaDoRanking;
use crate::modules::conta::FalhaExterna;
use crate::modules::progresso::{Dificuldade, Instrumento};

#[async_trait]
pub trait RepositorioDoRanking: Send + Sync {
    /// As linhas até a posição `ate` e, se `conta` tiver recorde, a linha dela, já numeradas.
    async fn linhas(
        &self,
        musica_id: &str,
        dificuldade: Dificuldade,
        instrumento: Instrumento,
        ate: u32,
        conta: Option<Uuid>,
    ) -> Result<Vec<LinhaDoRanking>, FalhaExterna>;
}
