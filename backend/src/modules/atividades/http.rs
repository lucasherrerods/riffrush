use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use super::dominio::{Atividade, Evento};
use crate::modules::progresso::{Dificuldade, Instrumento};
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

#[derive(Deserialize, IntoParams)]
pub struct PedidoDeAtividades {
    /// Só as atividades antes deste momento: a página seguinte do log.
    #[param(value_type = Option<String>, example = "2026-11-12T13:00:00Z")]
    antes: Option<DateTime<Utc>>,
    /// De 1 a 100; sem ele, 50.
    limite: Option<u32>,
}

#[derive(Serialize, ToSchema)]
#[serde(tag = "tipo", rename_all = "snake_case")]
pub enum EventoNaResposta {
    PartidaDoRock {
        musica_id: String,
        titulo: Option<String>,
        artista: Option<String>,
        #[schema(value_type = String, example = "guitarra")]
        instrumento: Instrumento,
        #[schema(value_type = String, example = "expert")]
        dificuldade: Dificuldade,
        precisao: Option<f64>,
        derrota: bool,
    },
    PartidaDoMania {
        beatmap_id: u64,
        beatmapset_id: Option<u64>,
        titulo: Option<String>,
        artista: Option<String>,
        dificuldade: Option<String>,
        precisao: f64,
        derrota: bool,
    },
    ContaNova,
}

#[derive(Serialize, ToSchema)]
pub struct AtividadeNaResposta {
    conta_id: Uuid,
    nome: String,
    avatar: Option<String>,
    quando: DateTime<Utc>,
    evento: EventoNaResposta,
}

impl From<Atividade> for AtividadeNaResposta {
    fn from(a: Atividade) -> Self {
        let evento = match a.evento {
            Evento::PartidaDoRock {
                musica_id,
                titulo,
                artista,
                instrumento,
                dificuldade,
                precisao,
                derrota,
            } => EventoNaResposta::PartidaDoRock {
                musica_id,
                titulo,
                artista,
                instrumento,
                dificuldade,
                precisao,
                derrota,
            },
            Evento::PartidaDoMania {
                beatmap_id,
                beatmapset_id,
                titulo,
                artista,
                dificuldade,
                precisao,
                derrota,
            } => EventoNaResposta::PartidaDoMania {
                beatmap_id,
                beatmapset_id,
                titulo,
                artista,
                dificuldade,
                precisao,
                derrota,
            },
            Evento::ContaNova => EventoNaResposta::ContaNova,
        };
        Self {
            conta_id: a.conta_id,
            nome: a.nome,
            avatar: a.avatar,
            quando: a.quando,
            evento,
        }
    }
}

/// O log de quem jogou o quê e quando, nos dois modos, mais as contas novas. Da mais recente para trás.
#[utoipa::path(get, path = "/atividades", params(PedidoDeAtividades), responses((status = 200, body = Vec<AtividadeNaResposta>)))]
pub async fn atividades(State(estado): State<EstadoDoApp>, Query(pedido): Query<PedidoDeAtividades>) -> Result<Json<Vec<AtividadeNaResposta>>, ErroDaApi> {
    let log = estado
        .atividades
        .recentes(pedido.antes, pedido.limite)
        .await
        .map_err(|falha| ErroDaApi::Interno(falha.0))?;
    Ok(Json(log.into_iter().map(Into::into).collect()))
}

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new().route("/atividades", get(atividades))
}
