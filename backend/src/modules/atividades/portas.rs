use async_trait::async_trait;
use chrono::{DateTime, Utc};

use super::dominio::Atividade;
use crate::modules::conta::FalhaExterna;

#[async_trait]
pub trait RepositorioDeAtividades: Send + Sync {
    /// As `limite` atividades mais recentes antes de `antes` (ou de agora), da mais nova para trás.
    /// As do Mania vêm com o texto do .osu guardado, se houver, para o caso de uso ler o nome.
    async fn recentes(&self, antes: Option<DateTime<Utc>>, limite: u32) -> Result<Vec<(Atividade, Option<String>)>, FalhaExterna>;
}
