use std::collections::HashMap;

use async_trait::async_trait;

use super::dominio::DadosDaMusica;
use crate::modules::conta::FalhaExterna;

#[async_trait]
pub trait RepositorioDoCatalogo: Send + Sync {
    /// Os dados já guardados de cada id pedido. Quem não está no mapa nunca foi procurado.
    async fn buscar(&self, ids: &[String]) -> Result<HashMap<String, DadosDaMusica>, FalhaExterna>;
    async fn guardar(&self, musica_id: &str, dados: &DadosDaMusica) -> Result<(), FalhaExterna>;
}

#[async_trait]
pub trait FonteDeMusicas: Send + Sync {
    /// Os dados do chart com esse md5. `None` se ninguém o conhece.
    async fn por_md5(&self, md5: &str) -> Result<Option<DadosDaMusica>, FalhaExterna>;
}
