use axum::extract::{FromRequestParts, State};
use axum::http::request::Parts;
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::casos_de_uso::{ErroDaConta, PartidaEnviada, XpDaPartida};
use super::dominio::Conta;
use super::portas::{ClienteDoGoogle, PedidoDeLogin};
use crate::modules::progresso::{Dificuldade, Instrumento, Nivel, ResumoDaPartida};
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

impl From<ErroDaConta> for ErroDaApi {
    fn from(erro: ErroDaConta) -> Self {
        match erro {
            ErroDaConta::SessaoInvalida | ErroDaConta::LoginRecusado => Self::NaoAutorizado,
            ErroDaConta::PartidaInvalida(_) | ErroDaConta::MusicaInvalida => Self::Invalido(erro.to_string()),
            ErroDaConta::RapidoDemais => Self::MuitasRequisicoes,
            ErroDaConta::Falha(falha) => Self::Interno(falha.0),
        }
    }
}

/// O token da sessão, lido do cabeçalho `Authorization: Bearer <token>`.
pub struct Token(pub String);

fn token_do_cabecalho(parts: &Parts) -> Option<String> {
    parts
        .headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|valor| valor.to_str().ok())
        .and_then(|valor| valor.strip_prefix("Bearer "))
        .filter(|token| !token.is_empty())
        .map(String::from)
}

impl<S: Send + Sync> FromRequestParts<S> for Token {
    type Rejection = ErroDaApi;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        token_do_cabecalho(parts).map(Token).ok_or(ErroDaApi::NaoAutorizado)
    }
}

/// Para rotas abertas que mostram algo a mais para quem está logado.
pub struct TokenOpcional(pub Option<String>);

impl<S: Send + Sync> FromRequestParts<S> for TokenOpcional {
    type Rejection = ErroDaApi;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        Ok(TokenOpcional(token_do_cabecalho(parts)))
    }
}

#[derive(Serialize, ToSchema)]
pub struct NivelDaConta {
    nivel: u32,
    xp_no_nivel: u64,
    xp_para_o_proximo: u64,
}

impl From<Nivel> for NivelDaConta {
    fn from(n: Nivel) -> Self {
        Self {
            nivel: n.nivel,
            xp_no_nivel: n.xp_no_nivel,
            xp_para_o_proximo: n.xp_para_o_proximo,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDaConta {
    id: Uuid,
    nome: String,
    avatar: Option<String>,
    xp_total: u64,
    nivel: NivelDaConta,
}

impl From<Conta> for RespostaDaConta {
    fn from(conta: Conta) -> Self {
        let nivel = conta.nivel().into();
        Self {
            id: conta.id,
            nome: conta.nome,
            avatar: conta.avatar,
            xp_total: conta.xp_total,
            nivel,
        }
    }
}

#[derive(Deserialize, ToSchema)]
pub struct CorpoDoLogin {
    codigo: String,
    verificador: String,
    redirect_uri: String,
    /// `web` (padrão) ou `desktop`.
    #[serde(default)]
    #[schema(value_type = Option<String>, example = "web")]
    cliente: ClienteDoGoogle,
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDoLogin {
    token: String,
    conta: RespostaDaConta,
}

/// Troca o código que o Google devolveu (fluxo PKCE) por uma sessão.
#[utoipa::path(post, path = "/auth/google", request_body = CorpoDoLogin, responses((status = 200, body = RespostaDoLogin), (status = 401)))]
pub async fn entrar(State(estado): State<EstadoDoApp>, Json(corpo): Json<CorpoDoLogin>) -> Result<Json<RespostaDoLogin>, ErroDaApi> {
    let pedido = PedidoDeLogin {
        codigo: corpo.codigo,
        verificador: corpo.verificador,
        redirect_uri: corpo.redirect_uri,
        cliente: corpo.cliente,
    };
    let entrada = estado.conta.entrar_com_google(&pedido).await?;
    Ok(Json(RespostaDoLogin {
        token: entrada.token,
        conta: entrada.conta.into(),
    }))
}

#[utoipa::path(post, path = "/auth/sair", responses((status = 204)), security(("token" = [])))]
pub async fn sair(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<StatusCode, ErroDaApi> {
    estado.conta.sair(&token).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(get, path = "/eu", responses((status = 200, body = RespostaDaConta), (status = 401)), security(("token" = [])))]
pub async fn eu(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<RespostaDaConta>, ErroDaApi> {
    Ok(Json(estado.conta.conta_da_sessao(&token).await?.into()))
}

/// Apaga a conta, as sessões e as partidas de quem está logado.
#[utoipa::path(delete, path = "/eu", responses((status = 204), (status = 401)), security(("token" = [])))]
pub async fn excluir(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<StatusCode, ErroDaApi> {
    estado.conta.excluir_conta(&token).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize, ToSchema)]
pub struct CorpoDaPartida {
    musica_id: String,
    #[schema(value_type = String, example = "medio")]
    dificuldade: Dificuldade,
    /// Sem ele, a guitarra.
    #[serde(default)]
    #[schema(value_type = String, example = "guitarra")]
    instrumento: Instrumento,
    pontos: u64,
    acertos: u32,
    total: u32,
    derrota: bool,
    #[serde(default)]
    fantasma: bool,
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDaPartida {
    xp_ganho: u64,
    antes: NivelDaConta,
    depois: NivelDaConta,
}

impl From<XpDaPartida> for RespostaDaPartida {
    fn from(xp: XpDaPartida) -> Self {
        Self {
            xp_ganho: xp.xp_ganho,
            antes: xp.antes.into(),
            depois: xp.depois.into(),
        }
    }
}

/// Registra o resumo de uma partida. O XP é calculado aqui, nunca vem do cliente.
#[utoipa::path(post, path = "/partidas", request_body = CorpoDaPartida, responses((status = 200, body = RespostaDaPartida), (status = 400), (status = 401), (status = 429)), security(("token" = [])))]
pub async fn registrar_partida(
    State(estado): State<EstadoDoApp>,
    Token(token): Token,
    Json(corpo): Json<CorpoDaPartida>,
) -> Result<Json<RespostaDaPartida>, ErroDaApi> {
    let partida = PartidaEnviada {
        musica_id: corpo.musica_id,
        instrumento: corpo.instrumento,
        pontos: corpo.pontos,
        resumo: ResumoDaPartida {
            dificuldade: corpo.dificuldade,
            acertos: corpo.acertos,
            total: corpo.total,
            derrota: corpo.derrota,
            fantasma: corpo.fantasma,
        },
    };
    Ok(Json(estado.conta.registrar_partida(&token, partida).await?.into()))
}

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new()
        .route("/auth/google", post(entrar))
        .route("/auth/sair", post(sair))
        .route("/eu", get(eu).delete(excluir))
        .route("/partidas", post(registrar_partida))
}
