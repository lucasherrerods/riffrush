use std::collections::HashMap;

use async_trait::async_trait;
use sqlx::{FromRow, PgPool};

use super::dominio::DadosDaMusica;
use super::portas::RepositorioDoCatalogo;
use crate::modules::conta::FalhaExterna;

pub struct CatalogoPostgres(pub PgPool);

#[derive(FromRow)]
struct Linha {
    musica_id: String,
    titulo: Option<String>,
    artista: Option<String>,
    capa: Option<String>,
}

fn falha(erro: sqlx::Error) -> FalhaExterna {
    FalhaExterna(format!("banco: {erro}"))
}

#[async_trait]
impl RepositorioDoCatalogo for CatalogoPostgres {
    async fn buscar(&self, ids: &[String]) -> Result<HashMap<String, DadosDaMusica>, FalhaExterna> {
        let linhas = sqlx::query_as::<_, Linha>("SELECT musica_id, titulo, artista, capa FROM musicas WHERE musica_id = ANY($1)")
            .bind(ids)
            .fetch_all(&self.0)
            .await
            .map_err(falha)?;
        Ok(linhas
            .into_iter()
            .map(|l| {
                let dados = DadosDaMusica {
                    titulo: l.titulo,
                    artista: l.artista,
                    capa: l.capa,
                };
                (l.musica_id, dados)
            })
            .collect())
    }

    async fn guardar(&self, musica_id: &str, dados: &DadosDaMusica) -> Result<(), FalhaExterna> {
        sqlx::query(
            "INSERT INTO musicas (musica_id, titulo, artista, capa) VALUES ($1, $2, $3, $4)
             ON CONFLICT (musica_id) DO UPDATE SET titulo = EXCLUDED.titulo, artista = EXCLUDED.artista,
                 capa = EXCLUDED.capa, buscada_em = now()",
        )
        .bind(musica_id)
        .bind(&dados.titulo)
        .bind(&dados.artista)
        .bind(&dados.capa)
        .execute(&self.0)
        .await
        .map(|_| ())
        .map_err(falha)
    }
}
