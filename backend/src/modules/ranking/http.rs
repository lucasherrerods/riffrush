use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use super::casos_de_uso::ErroDoRanking;
use super::dominio::{LinhaDoGeral, LinhaDoRanking, MusicaPopular, Ranking};
use crate::modules::conta::{NivelDaConta, TokenOpcional};
use crate::modules::progresso::{nivel_do_xp, Dificuldade, Instrumento};
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

impl From<ErroDoRanking> for ErroDaApi {
    fn from(erro: ErroDoRanking) -> Self {
        match erro {
            ErroDoRanking::MusicaInvalida => Self::Invalido(erro.to_string()),
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
    nome: String,
    avatar: Option<String>,
    pontos: u64,
    acertos: u32,
    total: u32,
    jogada_em: DateTime<Utc>,
}

impl From<LinhaDoRanking> for PosicaoNoRanking {
    fn from(l: LinhaDoRanking) -> Self {
        Self {
            posicao: l.posicao,
            nome: l.nome,
            avatar: l.avatar,
            pontos: l.pontos,
            acertos: l.acertos,
            total: l.total,
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
}

impl From<MusicaPopular> for MusicaNoRanking {
    fn from(m: MusicaPopular) -> Self {
        Self {
            posicao: m.posicao,
            musica_id: m.musica_id,
            partidas: m.partidas,
            jogadores: m.jogadores,
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

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new()
        .route("/ranking", get(ranking))
        .route("/ranking/geral", get(geral))
        .route("/ranking/musicas", get(musicas))
}
