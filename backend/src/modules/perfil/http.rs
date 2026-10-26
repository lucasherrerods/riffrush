use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;

use super::casos_de_uso::ErroDoPerfil;
use super::dominio::{EstatisticasDaDificuldade, MusicaMaisTocada, PartidaRecente, PartidasNoInstrumento, Perfil, Recorde};
use crate::modules::catalogo::DadosDaMusica;
use crate::modules::conta::{NivelDaConta, Token};
use crate::modules::progresso::{Dificuldade, Instrumento};
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
pub struct InstrumentoDoPerfil {
    #[schema(value_type = String, example = "guitarra")]
    instrumento: Instrumento,
    partidas: u32,
}

impl From<PartidasNoInstrumento> for InstrumentoDoPerfil {
    fn from(i: PartidasNoInstrumento) -> Self {
        Self {
            instrumento: i.instrumento,
            partidas: i.partidas,
        }
    }
}

/// Do catálogo: sem eles (músicas do jogo, não achadas), o app usa a biblioteca.
#[derive(Serialize, ToSchema)]
pub struct DadosDaMusicaNoPerfil {
    titulo: Option<String>,
    artista: Option<String>,
    /// Endereço da imagem da capa.
    capa: Option<String>,
}

impl From<Option<DadosDaMusica>> for DadosDaMusicaNoPerfil {
    fn from(dados: Option<DadosDaMusica>) -> Self {
        let dados = dados.unwrap_or_default();
        Self {
            titulo: dados.titulo,
            artista: dados.artista,
            capa: dados.capa,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct MusicaDoPerfil {
    musica_id: String,
    partidas: u32,
    #[serde(flatten)]
    dados: DadosDaMusicaNoPerfil,
}

impl From<(MusicaMaisTocada, Option<DadosDaMusica>)> for MusicaDoPerfil {
    fn from((m, dados): (MusicaMaisTocada, Option<DadosDaMusica>)) -> Self {
        Self {
            musica_id: m.musica_id,
            partidas: m.partidas,
            dados: dados.into(),
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
    /// De 0 a 1, a mesma do jogo: cada nota pesa pelo julgamento.
    precisao: f64,
    derrota: bool,
    jogada_em: DateTime<Utc>,
    #[serde(flatten)]
    dados: DadosDaMusicaNoPerfil,
}

impl From<(PartidaRecente, Option<DadosDaMusica>)> for PartidaDoPerfil {
    fn from((p, dados): (PartidaRecente, Option<DadosDaMusica>)) -> Self {
        Self {
            precisao: p.precisao(),
            dados: dados.into(),
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
    email: Option<String>,
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
    /// Só os instrumentos jogados, do mais jogado para o menos.
    por_instrumento: Vec<InstrumentoDoPerfil>,
    mais_tocadas: Vec<MusicaDoPerfil>,
    recentes: Vec<PartidaDoPerfil>,
}

impl From<Perfil> for RespostaDoPerfil {
    fn from(p: Perfil) -> Self {
        let musicas = p.musicas;
        Self {
            nome: p.conta.nome,
            avatar: p.conta.avatar,
            email: p.conta.email,
            xp_total: p.conta.xp_total,
            nivel: p.nivel.into(),
            criada_em: p.criada_em,
            partidas: p.partidas,
            derrotas: p.derrotas,
            precisao: p.precisao,
            melhor_pontuacao: p.melhor_pontuacao,
            musicas_distintas: p.musicas_distintas,
            por_dificuldade: p.por_dificuldade.into_iter().map(Into::into).collect(),
            por_instrumento: p.por_instrumento.into_iter().map(Into::into).collect(),
            mais_tocadas: p
                .mais_tocadas
                .into_iter()
                .map(|m| (m.musica_id.clone(), m))
                .map(|(id, m)| (m, musicas.get(&id).cloned()).into())
                .collect(),
            recentes: p
                .recentes
                .into_iter()
                .map(|r| (r.musica_id.clone(), r))
                .map(|(id, r)| (r, musicas.get(&id).cloned()).into())
                .collect(),
        }
    }
}

/// O perfil de quem está logado: nível, estatísticas e as últimas partidas.
#[utoipa::path(get, path = "/eu/perfil", responses((status = 200, body = RespostaDoPerfil), (status = 401)), security(("token" = [])))]
pub async fn perfil(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<RespostaDoPerfil>, ErroDaApi> {
    Ok(Json(estado.perfil.perfil(&token).await?.into()))
}

#[derive(Serialize, ToSchema)]
pub struct RecordeDaConta {
    musica_id: String,
    #[schema(value_type = String, example = "expert")]
    dificuldade: Dificuldade,
    #[schema(value_type = String, example = "guitarra")]
    instrumento: Instrumento,
    pontos: u64,
    acertos: u32,
    total: u32,
}

impl From<Recorde> for RecordeDaConta {
    fn from(r: Recorde) -> Self {
        Self {
            musica_id: r.musica_id,
            dificuldade: r.dificuldade,
            instrumento: r.instrumento,
            pontos: r.pontos,
            acertos: r.acertos,
            total: r.total,
        }
    }
}

/// A melhor partida terminada de cada música, dificuldade e instrumento de quem está logado.
#[utoipa::path(get, path = "/eu/recordes", responses((status = 200, body = [RecordeDaConta]), (status = 401)), security(("token" = [])))]
pub async fn recordes(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<Vec<RecordeDaConta>>, ErroDaApi> {
    Ok(Json(estado.perfil.recordes(&token).await?.into_iter().map(Into::into).collect()))
}

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new().route("/eu/perfil", get(perfil)).route("/eu/recordes", get(recordes))
}
