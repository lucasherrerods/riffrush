use std::collections::HashMap;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::dominio::{Faixa, ModoDaPlaylist, Playlist};
use super::portas::RepositorioDePlaylists;
use crate::modules::conta::FalhaExterna;

pub struct PlaylistsPostgres(pub PgPool);

#[derive(FromRow)]
struct LinhaDaPlaylist {
    id: Uuid,
    nome: String,
    modo: String,
    publica: bool,
    atualizada_em: DateTime<Utc>,
}

#[derive(FromRow)]
struct LinhaDaFaixa {
    playlist_id: Uuid,
    musica: String,
    versao: String,
    titulo: String,
}

const DA_CONTA: &str = "SELECT id, nome, modo, publica, atualizada_em FROM playlists WHERE conta_id = $1 ORDER BY atualizada_em DESC";

const FAIXAS: &str = "
    SELECT f.playlist_id, f.musica, f.versao, f.titulo FROM faixas_da_playlist f
    JOIN playlists p ON p.id = f.playlist_id
    WHERE p.conta_id = $1 ORDER BY f.playlist_id, f.posicao";

/// Só atualiza se a playlist já é da mesma conta: um id de outra conta não muda nada e volta sem linha.
const GUARDAR: &str = "
    INSERT INTO playlists (id, conta_id, nome, modo, publica, atualizada_em) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, modo = EXCLUDED.modo, publica = EXCLUDED.publica, atualizada_em = EXCLUDED.atualizada_em
    WHERE playlists.conta_id = EXCLUDED.conta_id
    RETURNING id";

fn falha(erro: sqlx::Error) -> FalhaExterna {
    FalhaExterna(format!("banco: {erro}"))
}

#[async_trait]
impl RepositorioDePlaylists for PlaylistsPostgres {
    async fn da_conta(&self, conta_id: Uuid) -> Result<Vec<Playlist>, FalhaExterna> {
        let linhas = sqlx::query_as::<_, LinhaDaPlaylist>(DA_CONTA)
            .bind(conta_id)
            .fetch_all(&self.0)
            .await
            .map_err(falha)?;
        let mut faixas: HashMap<Uuid, Vec<Faixa>> = HashMap::new();
        for f in sqlx::query_as::<_, LinhaDaFaixa>(FAIXAS)
            .bind(conta_id)
            .fetch_all(&self.0)
            .await
            .map_err(falha)?
        {
            faixas.entry(f.playlist_id).or_default().push(Faixa {
                musica: f.musica,
                versao: f.versao,
                titulo: f.titulo,
            });
        }
        // Um modo que o domínio não conhece fica de fora, em vez de derrubar a lista.
        Ok(linhas
            .into_iter()
            .filter_map(|l| {
                Some(Playlist {
                    modo: ModoDaPlaylist::do_texto(&l.modo)?,
                    faixas: faixas.remove(&l.id).unwrap_or_default(),
                    id: l.id,
                    nome: l.nome,
                    publica: l.publica,
                    atualizada_em: l.atualizada_em,
                })
            })
            .collect())
    }

    async fn guardar(&self, conta_id: Uuid, playlist: &Playlist) -> Result<bool, FalhaExterna> {
        let mut transacao = self.0.begin().await.map_err(falha)?;
        let guardada = sqlx::query_scalar::<_, Uuid>(GUARDAR)
            .bind(playlist.id)
            .bind(conta_id)
            .bind(&playlist.nome)
            .bind(playlist.modo.como_texto())
            .bind(playlist.publica)
            .bind(playlist.atualizada_em)
            .fetch_optional(&mut *transacao)
            .await
            .map_err(falha)?;
        if guardada.is_none() {
            return Ok(false);
        }
        sqlx::query("DELETE FROM faixas_da_playlist WHERE playlist_id = $1")
            .bind(playlist.id)
            .execute(&mut *transacao)
            .await
            .map_err(falha)?;
        for (posicao, faixa) in playlist.faixas.iter().enumerate() {
            sqlx::query("INSERT INTO faixas_da_playlist (playlist_id, posicao, musica, versao, titulo) VALUES ($1, $2, $3, $4, $5)")
                .bind(playlist.id)
                .bind(i32::try_from(posicao).unwrap_or(i32::MAX))
                .bind(&faixa.musica)
                .bind(&faixa.versao)
                .bind(&faixa.titulo)
                .execute(&mut *transacao)
                .await
                .map_err(falha)?;
        }
        transacao.commit().await.map_err(falha)?;
        Ok(true)
    }

    async fn apagar(&self, conta_id: Uuid, id: Uuid) -> Result<(), FalhaExterna> {
        sqlx::query("DELETE FROM playlists WHERE id = $1 AND conta_id = $2")
            .bind(id)
            .bind(conta_id)
            .execute(&self.0)
            .await
            .map_err(falha)?;
        Ok(())
    }
}
