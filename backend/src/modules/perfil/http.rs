use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;

use super::casos_de_uso::ErroDoPerfil;
use super::dominio::{EstatisticasDaDificuldade, PartidaRecente, Perfil};
use crate::modules::conta::{NivelDaConta, Token};
use crate::modules::progresso::Dificuldade;
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

impl From<ErroDoPerfil> for ErroDaApi {
    fn from(erro: ErroDoPerfil) -> Self {
        match erro {
            ErroDoPerfil::SessaoInvalida => Self::NaoAutorizado,
            ErroDoPerfil::Falha(falha) => Self::Interno(falha.0),
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct DificuldadeDoPerfil {
    #[schema(value_type = String, example = "expert")]
    dificuldade: Dificuldade,
    partidas: u32,
    derrotas: u32,
    precisao: f64,
    melhor_pontuacao: u64,
}

impl From<EstatisticasDaDificuldade> for DificuldadeDoPerfil {
    fn from(e: EstatisticasDaDificuldade) -> Self {
        Self {
            precisao: e.precisao(),
            dificuldade: e.dificuldade,
            partidas: e.partidas,
            derrotas: e.derrotas,
            melhor_pontuacao: e.melhor_pontuacao,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct PartidaDoPerfil {
    musica_id: String,
    #[schema(value_type = String, example = "expert")]
    dificuldade: Dificuldade,
    pontos: u64,
    acertos: u32,
    total: u32,
    derrota: bool,
    jogada_em: DateTime<Utc>,
}

impl From<PartidaRecente> for PartidaDoPerfil {
    fn from(p: PartidaRecente) -> Self {
        Self {
            musica_id: p.musica_id,
            dificuldade: p.dificuldade,
            pontos: p.pontos,
            acertos: p.acertos,
            total: p.total,
            derrota: p.derrota,
            jogada_em: p.jogada_em,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDoPerfil {
    nome: String,
    avatar: Option<String>,
    xp_total: u64,
    nivel: NivelDaConta,
    criada_em: DateTime<Utc>,
    partidas: u32,
    derrotas: u32,
    /// De 0 a 1.
    precisao: f64,
    melhor_pontuacao: u64,
    musicas_distintas: u32,
    por_dificuldade: Vec<DificuldadeDoPerfil>,
    recentes: Vec<PartidaDoPerfil>,
}

impl From<Perfil> for RespostaDoPerfil {
    fn from(p: Perfil) -> Self {
        Self {
            nome: p.conta.nome,
            avatar: p.conta.avatar,
            xp_total: p.conta.xp_total,
            nivel: p.nivel.into(),
            criada_em: p.criada_em,
            partidas: p.partidas,
            derrotas: p.derrotas,
            precisao: p.precisao,
            melhor_pontuacao: p.melhor_pontuacao,
            musicas_distintas: p.musicas_distintas,
            por_dificuldade: p.por_dificuldade.into_iter().map(Into::into).collect(),
            recentes: p.recentes.into_iter().map(Into::into).collect(),
        }
    }
}

/// O perfil de quem está logado: nível, estatísticas e as últimas partidas.
#[utoipa::path(get, path = "/eu/perfil", responses((status = 200, body = RespostaDoPerfil), (status = 401)), security(("token" = [])))]
pub async fn perfil(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<RespostaDoPerfil>, ErroDaApi> {
    Ok(Json(estado.perfil.perfil(&token).await?.into()))
}

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new().route("/eu/perfil", get(perfil))
}
