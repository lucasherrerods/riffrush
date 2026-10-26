use axum::extract::{Path, Query, State};
use axum::http::header;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use super::casos_de_uso::ErroDoRanking;
use super::dominio::{LinhaDoGeral, LinhaDoRanking, MusicaPopular, PartidaPublica, Ranking};
use crate::modules::catalogo::DadosDaMusica;
use crate::modules::conta::{NivelDaConta, TokenOpcional};
use crate::modules::progresso::{nivel_do_xp, Dificuldade, Instrumento};
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

impl From<ErroDoRanking> for ErroDaApi {
    fn from(erro: ErroDoRanking) -> Self {
        match erro {
            ErroDoRanking::MusicaInvalida => Self::Invalido(erro.to_string()),
            ErroDoRanking::PartidaNaoEncontrada => Self::NaoEncontrado,
            ErroDoRanking::Falha(falha) => Self::Interno(falha.0),
        }
    }
}

#[derive(Deserialize, IntoParams)]
pub struct PedidoDoRanking {
    musica_id: String,
    #[param(value_type = String, example = "expert")]
    dificuldade: Dificuldade,
    /// Sem ele, o ranking da guitarra.
    #[serde(default)]
    #[param(value_type = Option<String>, example = "baixo")]
    instrumento: Instrumento,
}

#[derive(Serialize, ToSchema)]
pub struct PosicaoNoRanking {
    posicao: u32,
    partida_id: Uuid,
    nome: String,
    avatar: Option<String>,
    pontos: u64,
    acertos: u32,
    total: u32,
    /// De 0 a 1, pelo valor de cada nota. É o que ordena o ranking.
    precisao: f64,
    maior_sequencia: Option<u32>,
    jogada_em: DateTime<Utc>,
}

impl From<LinhaDoRanking> for PosicaoNoRanking {
    fn from(l: LinhaDoRanking) -> Self {
        Self {
            posicao: l.posicao,
            partida_id: l.partida_id,
            nome: l.nome,
            avatar: l.avatar,
            pontos: l.pontos,
            acertos: l.acertos,
            total: l.total,
            precisao: l.precisao,
            maior_sequencia: l.maior_sequencia,
            jogada_em: l.jogada_em,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDoRanking {
    jogadores: u32,
    top: Vec<PosicaoNoRanking>,
    /// O recorde de quem mandou o token, mesmo fora do top.
    meu: Option<PosicaoNoRanking>,
}

impl From<Ranking> for RespostaDoRanking {
    fn from(r: Ranking) -> Self {
        Self {
            jogadores: r.jogadores,
            top: r.top.into_iter().map(Into::into).collect(),
            meu: r.meu.map(Into::into),
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct PosicaoNoGeral {
    posicao: u32,
    nome: String,
    avatar: Option<String>,
    xp_total: u64,
    nivel: NivelDaConta,
}

impl From<LinhaDoGeral> for PosicaoNoGeral {
    fn from(l: LinhaDoGeral) -> Self {
        Self {
            posicao: l.posicao,
            nome: l.nome,
            avatar: l.avatar,
            nivel: nivel_do_xp(l.xp_total).into(),
            xp_total: l.xp_total,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDoGeral {
    jogadores: u32,
    top: Vec<PosicaoNoGeral>,
    /// A posição de quem mandou o token, mesmo fora do top.
    meu: Option<PosicaoNoGeral>,
}

impl From<Ranking<LinhaDoGeral>> for RespostaDoGeral {
    fn from(r: Ranking<LinhaDoGeral>) -> Self {
        Self {
            jogadores: r.jogadores,
            top: r.top.into_iter().map(Into::into).collect(),
            meu: r.meu.map(Into::into),
        }
    }
}

/// Os jogadores com mais XP. Com o token, vem também a posição de quem pediu.
#[utoipa::path(get, path = "/ranking/geral", responses((status = 200, body = RespostaDoGeral)), security((), ("token" = [])))]
pub async fn geral(State(estado): State<EstadoDoApp>, TokenOpcional(token): TokenOpcional) -> Result<Json<RespostaDoGeral>, ErroDaApi> {
    Ok(Json(estado.ranking.geral(token.as_deref()).await?.into()))
}

#[derive(Serialize, ToSchema)]
pub struct MusicaNoRanking {
    posicao: u32,
    musica_id: String,
    partidas: u32,
    jogadores: u32,
    /// Do Encore ou do nome do arquivo. Sem eles (músicas do jogo, não achadas), o app usa a biblioteca.
    titulo: Option<String>,
    artista: Option<String>,
    /// Endereço da imagem da capa.
    capa: Option<String>,
}

impl From<(MusicaPopular, DadosDaMusica)> for MusicaNoRanking {
    fn from((m, dados): (MusicaPopular, DadosDaMusica)) -> Self {
        Self {
            posicao: m.posicao,
            musica_id: m.musica_id,
            partidas: m.partidas,
            jogadores: m.jogadores,
            titulo: dados.titulo,
            artista: dados.artista,
            capa: dados.capa,
        }
    }
}

/// As músicas com mais partidas, somando todos os jogadores.
#[utoipa::path(get, path = "/ranking/musicas", responses((status = 200, body = Vec<MusicaNoRanking>)))]
pub async fn musicas(State(estado): State<EstadoDoApp>) -> Result<Json<Vec<MusicaNoRanking>>, ErroDaApi> {
    Ok(Json(estado.ranking.musicas().await?.into_iter().map(Into::into).collect()))
}

/// O top de uma música, dificuldade e instrumento. Com o token, vem também o recorde de quem pediu.
#[utoipa::path(get, path = "/ranking", params(PedidoDoRanking), responses((status = 200, body = RespostaDoRanking), (status = 400)), security((), ("token" = [])))]
pub async fn ranking(
    State(estado): State<EstadoDoApp>,
    TokenOpcional(token): TokenOpcional,
    Query(pedido): Query<PedidoDoRanking>,
) -> Result<Json<RespostaDoRanking>, ErroDaApi> {
    let ranking = estado
        .ranking
        .ranking(&pedido.musica_id, pedido.dificuldade, pedido.instrumento, token.as_deref())
        .await?;
    Ok(Json(ranking.into()))
}

#[derive(Serialize, ToSchema)]
pub struct PartidaDoRanking {
    id: Uuid,
    nome: String,
    avatar: Option<String>,
    musica_id: String,
    #[schema(value_type = String, example = "expert")]
    dificuldade: Dificuldade,
    #[schema(value_type = String, example = "guitarra")]
    instrumento: Instrumento,
    pontos: u64,
    acertos: u32,
    total: u32,
    /// De 0 a 1, pelo valor de cada nota. Só as partidas que o servidor rejulgou têm.
    precisao: Option<f64>,
    /// Partidas antigas não têm.
    maior_sequencia: Option<u32>,
    derrota: bool,
    fantasma: bool,
    jogada_em: DateTime<Utc>,
    /// Se dá para assistir em `/partidas/{id}/replay`.
    tem_replay: bool,
}

impl From<PartidaPublica> for PartidaDoRanking {
    fn from(p: PartidaPublica) -> Self {
        Self {
            id: p.id,
            nome: p.nome,
            avatar: p.avatar,
            musica_id: p.musica_id,
            dificuldade: p.dificuldade,
            instrumento: p.instrumento,
            pontos: p.pontos,
            acertos: p.acertos,
            total: p.total,
            precisao: p.precisao,
            maior_sequencia: p.maior_sequencia,
            derrota: p.derrota,
            fantasma: p.fantasma,
            jogada_em: p.jogada_em,
            tem_replay: p.tem_replay,
        }
    }
}

/// O replay comprimido da partida, no formato do app.
#[utoipa::path(get, path = "/partidas/{id}/replay", params(("id" = Uuid, Path)), responses((status = 200, content_type = "application/octet-stream", body = Vec<u8>), (status = 404)))]
pub async fn replay(State(estado): State<EstadoDoApp>, Path(id): Path<Uuid>) -> Result<impl IntoResponse, ErroDaApi> {
    let bytes = estado.ranking.replay(id).await?;
    Ok(([(header::CONTENT_TYPE, "application/octet-stream")], bytes))
}

/// As estatísticas de uma partida do ranking, para qualquer um ver.
#[utoipa::path(get, path = "/partidas/{id}", params(("id" = Uuid, Path)), responses((status = 200, body = PartidaDoRanking), (status = 404)))]
pub async fn partida(State(estado): State<EstadoDoApp>, Path(id): Path<Uuid>) -> Result<Json<PartidaDoRanking>, ErroDaApi> {
    Ok(Json(estado.ranking.partida(id).await?.into()))
}

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new()
        .route("/ranking", get(ranking))
        .route("/ranking/geral", get(geral))
        .route("/ranking/musicas", get(musicas))
        .route("/partidas/{id}", get(partida))
        .route("/partidas/{id}/replay", get(replay))
}
