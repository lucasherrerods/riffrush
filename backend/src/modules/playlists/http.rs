use axum::extract::{DefaultBodyLimit, Path, State};
use axum::http::StatusCode;
use axum::routing::{get, put};
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::casos_de_uso::ErroDasPlaylists;
use super::dominio::{Faixa, ModoDaPlaylist, Playlist};
use crate::modules::conta::Token;
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

/// 50 faixas com id, versão e título no tamanho máximo cabem com folga.
const CORPO_MAXIMO: usize = 64 * 1024;

impl From<ErroDasPlaylists> for ErroDaApi {
    fn from(erro: ErroDasPlaylists) -> Self {
        match erro {
            ErroDasPlaylists::SessaoInvalida => Self::NaoAutorizado,
            ErroDasPlaylists::Invalida(erro) => Self::Invalido(erro.to_string()),
            ErroDasPlaylists::DeOutraConta | ErroDasPlaylists::NaoEAmigo => Self::Proibido,
            ErroDasPlaylists::Falha(falha) => Self::Interno(falha.0),
        }
    }
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct FaixaDaPlaylist {
    musica: String,
    /// A dificuldade no Rock; o hash do beatmap no Mania.
    versao: String,
    titulo: String,
}

#[derive(Deserialize, ToSchema)]
pub struct PedidoDePlaylist {
    nome: String,
    #[schema(example = "rock")]
    modo: String,
    /// Aparece no perfil para os amigos.
    publica: bool,
    faixas: Vec<FaixaDaPlaylist>,
}

#[derive(Serialize, ToSchema)]
pub struct PlaylistNaResposta {
    id: Uuid,
    nome: String,
    #[schema(example = "rock")]
    modo: String,
    publica: bool,
    faixas: Vec<FaixaDaPlaylist>,
    atualizada_em: DateTime<Utc>,
}

impl From<Playlist> for PlaylistNaResposta {
    fn from(p: Playlist) -> Self {
        Self {
            id: p.id,
            nome: p.nome,
            modo: p.modo.como_texto().into(),
            publica: p.publica,
            faixas: p
                .faixas
                .into_iter()
                .map(|f| FaixaDaPlaylist {
                    musica: f.musica,
                    versao: f.versao,
                    titulo: f.titulo,
                })
                .collect(),
            atualizada_em: p.atualizada_em,
        }
    }
}

fn em_resposta(lista: Vec<Playlist>) -> Json<Vec<PlaylistNaResposta>> {
    Json(lista.into_iter().map(Into::into).collect())
}

/// As playlists de quem está logado, nos dois modos, da editada por último para trás.
#[utoipa::path(get, path = "/eu/playlists", responses((status = 200, body = Vec<PlaylistNaResposta>), (status = 401)), security(("token" = [])))]
pub async fn minhas(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<Vec<PlaylistNaResposta>>, ErroDaApi> {
    Ok(em_resposta(estado.playlists.minhas(&token).await?))
}

/// Cria ou troca a playlist inteira pelo id que o jogo gerou. Até 10 por conta e 50 músicas em cada.
#[utoipa::path(
    put,
    path = "/eu/playlists/{id}",
    params(("id" = Uuid, Path)),
    request_body = PedidoDePlaylist,
    responses((status = 200, body = PlaylistNaResposta), (status = 400), (status = 401), (status = 403)),
    security(("token" = []))
)]
pub async fn guardar(
    State(estado): State<EstadoDoApp>,
    Token(token): Token,
    Path(id): Path<Uuid>,
    Json(pedido): Json<PedidoDePlaylist>,
) -> Result<Json<PlaylistNaResposta>, ErroDaApi> {
    let modo = ModoDaPlaylist::do_texto(&pedido.modo).ok_or_else(|| ErroDaApi::Invalido("modo deve ser rock ou mania".into()))?;
    let playlist = Playlist {
        id,
        nome: pedido.nome,
        modo,
        publica: pedido.publica,
        faixas: pedido
            .faixas
            .into_iter()
            .map(|f| Faixa {
                musica: f.musica,
                versao: f.versao,
                titulo: f.titulo,
            })
            .collect(),
        atualizada_em: DateTime::UNIX_EPOCH,
    };
    Ok(Json(estado.playlists.guardar(&token, playlist).await?.into()))
}

#[utoipa::path(delete, path = "/eu/playlists/{id}", params(("id" = Uuid, Path)), responses((status = 204), (status = 401)), security(("token" = [])))]
pub async fn apagar(State(estado): State<EstadoDoApp>, Token(token): Token, Path(id): Path<Uuid>) -> Result<StatusCode, ErroDaApi> {
    estado.playlists.apagar(&token, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// As playlists que um amigo deixou visíveis no perfil.
#[utoipa::path(
    get,
    path = "/amigos/{conta_id}/playlists",
    params(("conta_id" = Uuid, Path)),
    responses((status = 200, body = Vec<PlaylistNaResposta>), (status = 401), (status = 403)),
    security(("token" = []))
)]
pub async fn do_amigo(State(estado): State<EstadoDoApp>, Token(token): Token, Path(conta_id): Path<Uuid>) -> Result<Json<Vec<PlaylistNaResposta>>, ErroDaApi> {
    Ok(em_resposta(estado.playlists.do_amigo(&token, conta_id).await?))
}

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new()
        .route("/eu/playlists", get(minhas))
        .route("/eu/playlists/{id}", put(guardar).delete(apagar).layer(DefaultBodyLimit::max(CORPO_MAXIMO)))
        .route("/amigos/{conta_id}/playlists", get(do_amigo))
}
