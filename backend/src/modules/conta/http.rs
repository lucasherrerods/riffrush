use axum::extract::{FromRequestParts, Path, State};
use axum::http::request::Parts;
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use base64::prelude::{Engine, BASE64_STANDARD};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::casos_de_uso::{ErroDaConta, PartidaEnviada, Registro, SituacaoDaPartida, XpDaPartida};
use super::dominio::Conta;
use super::portas::{ClienteDoGoogle, PedidoDeLogin};
use crate::modules::progresso::{Dificuldade, Instrumento, Nivel, ResumoDaPartida};
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

impl From<ErroDaConta> for ErroDaApi {
    fn from(erro: ErroDaConta) -> Self {
        match erro {
            ErroDaConta::SessaoInvalida | ErroDaConta::LoginRecusado => Self::NaoAutorizado,
            ErroDaConta::PartidaInvalida(_) | ErroDaConta::MusicaInvalida | ErroDaConta::ReplayObrigatorio => Self::Invalido(erro.to_string()),
            ErroDaConta::RapidoDemais => Self::MuitasRequisicoes,
            ErroDaConta::PartidaNaoEncontrada => Self::NaoEncontrado,
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
    email: Option<String>,
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
            email: conta.email,
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
    /// Apps antigos não mandam.
    #[serde(default)]
    maior_sequencia: Option<u32>,
    /// Soma do valor de cada acerto pelo julgamento (300, 100 ou 50). Apps antigos não mandam.
    #[serde(default)]
    valor_dos_acertos: Option<u32>,
    /// As entradas da partida comprimidas, em base64. Só em partida que vale para o ranking.
    #[serde(default)]
    replay: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDaPartida {
    xp_ganho: u64,
    antes: NivelDaConta,
    depois: NivelDaConta,
}

/// Partida de música do Encore: o XP entra na conta quando o servidor terminar de rejulgar o replay.
#[derive(Serialize, ToSchema)]
pub struct RespostaDaPartidaNaFila {
    pendente: bool,
    id: Uuid,
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

/// Registra uma partida. O XP é calculado aqui, nunca vem do cliente. Nas músicas do Encore, a partida
/// entra numa fila e o servidor rejulga o replay antes de dar o XP (202).
#[utoipa::path(post, path = "/partidas", request_body = CorpoDaPartida, responses((status = 200, body = RespostaDaPartida), (status = 202, body = RespostaDaPartidaNaFila), (status = 400), (status = 401), (status = 429)), security(("token" = [])))]
pub async fn registrar_partida(
    State(estado): State<EstadoDoApp>,
    Token(token): Token,
    Json(corpo): Json<CorpoDaPartida>,
) -> Result<axum::response::Response, ErroDaApi> {
    use axum::response::IntoResponse;
    let replay = match corpo.replay {
        Some(texto) => Some(BASE64_STANDARD.decode(texto).map_err(|_| ErroDaApi::Invalido("o replay não é base64".into()))?),
        None => None,
    };
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
            maior_sequencia: corpo.maior_sequencia,
            valor_dos_acertos: corpo.valor_dos_acertos,
        },
        replay,
    };
    Ok(match estado.conta.registrar_partida(&token, partida).await? {
        Registro::Registrada(xp) => Json(RespostaDaPartida::from(xp)).into_response(),
        Registro::NaFila { id } => (StatusCode::ACCEPTED, Json(RespostaDaPartidaNaFila { pendente: true, id })).into_response(),
    })
}

/// Partida que ainda está na fila, ou que o rejulgamento recusou e não vale XP.
#[derive(Serialize, ToSchema)]
pub struct RespostaDaSituacao {
    pendente: bool,
    recusada: bool,
}

/// Em que pé está uma partida da fila: o XP, quando o servidor terminou de rejulgar (200), ou se ela ainda
/// espera ou foi recusada (202).
#[utoipa::path(get, path = "/partidas/{id}/xp", params(("id" = Uuid, Path)), responses((status = 200, body = RespostaDaPartida), (status = 202, body = RespostaDaSituacao), (status = 401), (status = 404)), security(("token" = [])))]
pub async fn situacao_da_partida(State(estado): State<EstadoDoApp>, Token(token): Token, Path(id): Path<Uuid>) -> Result<axum::response::Response, ErroDaApi> {
    use axum::response::IntoResponse;
    Ok(match estado.conta.situacao_da_partida(&token, id).await? {
        SituacaoDaPartida::Registrada(xp) => Json(RespostaDaPartida::from(xp)).into_response(),
        SituacaoDaPartida::NaFila => (
            StatusCode::ACCEPTED,
            Json(RespostaDaSituacao {
                pendente: true,
                recusada: false,
            }),
        )
            .into_response(),
        SituacaoDaPartida::Recusada => (
            StatusCode::ACCEPTED,
            Json(RespostaDaSituacao {
                pendente: false,
                recusada: true,
            }),
        )
            .into_response(),
    })
}

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new()
        .route("/auth/google", post(entrar))
        .route("/auth/sair", post(sair))
        .route("/eu", get(eu).delete(excluir))
        .route("/partidas", post(registrar_partida))
        .route("/partidas/{id}/xp", get(situacao_da_partida))
}
