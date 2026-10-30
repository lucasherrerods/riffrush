use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::casos_de_uso::{Alvo, ErroDaAmizade, Pedido};
use super::dominio::{Pessoa, Sugestao, Vinculo};
use crate::modules::conta::Token;
use crate::modules::progresso::nivel_do_xp;
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

/// Um código colado com sobra de espaços ainda cabe; mais que isso não é código.
const TAMANHO_MAXIMO_DO_CODIGO: usize = 64;

impl From<ErroDaAmizade> for ErroDaApi {
    fn from(erro: ErroDaAmizade) -> Self {
        match erro {
            ErroDaAmizade::SessaoInvalida => Self::NaoAutorizado,
            ErroDaAmizade::NaoEncontrada | ErroDaAmizade::PedidoNaoEncontrado => Self::NaoEncontrado,
            ErroDaAmizade::RapidoDemais => Self::MuitasRequisicoes,
            ErroDaAmizade::CodigoInvalido | ErroDaAmizade::Recusado(_) => Self::Invalido(erro.to_string()),
            ErroDaAmizade::Falha(falha) => Self::Interno(falha.0),
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct PessoaDaAmizade {
    conta_id: Uuid,
    nome: String,
    avatar: Option<String>,
    nivel: u32,
    /// A última vez que a pessoa abriu o jogo logada.
    visto_em: Option<DateTime<Utc>>,
    /// Desde quando são amigos, quando o pedido saiu ou quando bloqueou.
    desde: DateTime<Utc>,
}

impl From<Pessoa> for PessoaDaAmizade {
    fn from(p: Pessoa) -> Self {
        Self {
            conta_id: p.conta_id,
            nome: p.nome,
            avatar: p.avatar,
            nivel: nivel_do_xp(p.xp_total).nivel,
            visto_em: p.visto_em,
            desde: p.desde,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDosAmigos {
    /// O código que a conta passa para ser adicionada.
    codigo: String,
    amigos: Vec<PessoaDaAmizade>,
    /// Pedidos esperando a resposta da conta.
    recebidos: Vec<PessoaDaAmizade>,
    /// Pedidos da conta esperando a resposta dos outros.
    enviados: Vec<PessoaDaAmizade>,
    bloqueados: Vec<PessoaDaAmizade>,
}

#[derive(Serialize, ToSchema)]
pub struct SugestaoDeAmizade {
    conta_id: Uuid,
    nome: String,
    avatar: Option<String>,
    nivel: u32,
    amigos_em_comum: u32,
}

impl From<Sugestao> for SugestaoDeAmizade {
    fn from(s: Sugestao) -> Self {
        Self {
            conta_id: s.conta_id,
            nome: s.nome,
            avatar: s.avatar,
            nivel: nivel_do_xp(s.xp_total).nivel,
            amigos_em_comum: s.amigos_em_comum,
        }
    }
}

/// O pedido vai pelo código de amigo ou pela conta (de uma sugestão, do ranking, do chat).
#[derive(Deserialize, ToSchema)]
pub struct CorpoDoPedido {
    codigo: Option<String>,
    conta_id: Option<Uuid>,
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDoPedido {
    /// A outra pessoa já tinha pedido: viraram amigos na hora.
    amigos: bool,
}

/// Amigos, pedidos e bloqueados da conta, com o código de amigo dela. Conta como "visto agora".
#[utoipa::path(get, path = "/amigos", responses((status = 200, body = RespostaDosAmigos), (status = 401)), security(("token" = [])))]
pub async fn amigos(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<RespostaDosAmigos>, ErroDaApi> {
    let listas = estado.amizade.listas(&token).await?;
    let mut resposta = RespostaDosAmigos {
        codigo: listas.codigo,
        amigos: Vec::new(),
        recebidos: Vec::new(),
        enviados: Vec::new(),
        bloqueados: Vec::new(),
    };
    for pessoa in listas.pessoas {
        let lista = match pessoa.vinculo {
            Vinculo::Amigo => &mut resposta.amigos,
            Vinculo::Recebido => &mut resposta.recebidos,
            Vinculo::Enviado => &mut resposta.enviados,
            Vinculo::Bloqueado => &mut resposta.bloqueados,
        };
        lista.push(pessoa.into());
    }
    Ok(Json(resposta))
}

/// Amigos de amigos que a conta talvez conheça.
#[utoipa::path(get, path = "/amigos/sugestoes", responses((status = 200, body = [SugestaoDeAmizade]), (status = 401)), security(("token" = [])))]
pub async fn sugestoes(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<Vec<SugestaoDeAmizade>>, ErroDaApi> {
    Ok(Json(estado.amizade.sugestoes(&token).await?.into_iter().map(Into::into).collect()))
}

/// Pede amizade. Se a outra pessoa já tinha pedido, aceita.
#[utoipa::path(post, path = "/amigos/pedidos", request_body = CorpoDoPedido, responses((status = 200, body = RespostaDoPedido), (status = 400), (status = 401), (status = 404), (status = 429)), security(("token" = [])))]
pub async fn pedir(State(estado): State<EstadoDoApp>, Token(token): Token, Json(corpo): Json<CorpoDoPedido>) -> Result<Json<RespostaDoPedido>, ErroDaApi> {
    let alvo = match (corpo.codigo, corpo.conta_id) {
        (Some(codigo), None) if codigo.len() <= TAMANHO_MAXIMO_DO_CODIGO => Alvo::Codigo(codigo),
        (None, Some(id)) => Alvo::Conta(id),
        _ => return Err(ErroDaAmizade::CodigoInvalido.into()),
    };
    let pedido = estado.amizade.pedir(&token, alvo).await?;
    Ok(Json(RespostaDoPedido {
        amigos: pedido == Pedido::Aceito,
    }))
}

#[utoipa::path(post, path = "/amigos/{conta_id}/aceitar", params(("conta_id" = Uuid, Path)), responses((status = 204), (status = 400), (status = 401), (status = 404)), security(("token" = [])))]
pub async fn aceitar(State(estado): State<EstadoDoApp>, Token(token): Token, Path(conta_id): Path<Uuid>) -> Result<StatusCode, ErroDaApi> {
    estado.amizade.aceitar(&token, conta_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Remove o amigo, recusa o pedido recebido ou cancela o enviado.
#[utoipa::path(delete, path = "/amigos/{conta_id}", params(("conta_id" = Uuid, Path)), responses((status = 204), (status = 401)), security(("token" = [])))]
pub async fn desfazer(State(estado): State<EstadoDoApp>, Token(token): Token, Path(conta_id): Path<Uuid>) -> Result<StatusCode, ErroDaApi> {
    estado.amizade.desfazer(&token, conta_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Bloqueia: desfaz a amizade e os pedidos, e os pedidos dela deixam de chegar.
#[utoipa::path(post, path = "/amigos/{conta_id}/bloqueio", params(("conta_id" = Uuid, Path)), responses((status = 204), (status = 400), (status = 401), (status = 404)), security(("token" = [])))]
pub async fn bloquear(State(estado): State<EstadoDoApp>, Token(token): Token, Path(conta_id): Path<Uuid>) -> Result<StatusCode, ErroDaApi> {
    estado.amizade.bloquear(&token, conta_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(delete, path = "/amigos/{conta_id}/bloqueio", params(("conta_id" = Uuid, Path)), responses((status = 204), (status = 401)), security(("token" = [])))]
pub async fn desbloquear(State(estado): State<EstadoDoApp>, Token(token): Token, Path(conta_id): Path<Uuid>) -> Result<StatusCode, ErroDaApi> {
    estado.amizade.desbloquear(&token, conta_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new()
        .route("/amigos", get(amigos))
        .route("/amigos/sugestoes", get(sugestoes))
        .route("/amigos/pedidos", post(pedir))
        .route("/amigos/{conta_id}", delete(desfazer))
        .route("/amigos/{conta_id}/aceitar", post(aceitar))
        .route("/amigos/{conta_id}/bloqueio", post(bloquear).delete(desbloquear))
}
