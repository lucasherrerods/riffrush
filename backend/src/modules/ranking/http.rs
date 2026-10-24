use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use super::casos_de_uso::ErroDoRanking;
use super::dominio::{LinhaDoRanking, Ranking};
use crate::modules::conta::TokenOpcional;
use crate::modules::progresso::{Dificuldade, Instrumento};
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
    Router::new().route("/ranking", get(ranking))
}
