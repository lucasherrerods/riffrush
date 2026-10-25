use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::casos_de_uso::ErroDaModeracao;
use super::dominio::{Banido, Denuncia, DenunciaRecebida};
use super::relay::{CABECALHO_DA_ASSINATURA, CABECALHO_DA_HORA};
use crate::modules::conta::Token;
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

impl From<ErroDaModeracao> for ErroDaApi {
    fn from(erro: ErroDaModeracao) -> Self {
        match erro {
            ErroDaModeracao::Desligada => Self::Indisponivel,
            ErroDaModeracao::SessaoInvalida | ErroDaModeracao::AssinaturaInvalida => Self::NaoAutorizado,
            ErroDaModeracao::SoAModeracao => Self::Proibido,
            ErroDaModeracao::ContaNaoEncontrada => Self::NaoEncontrado,
            ErroDaModeracao::ModeracaoNaoEBanida | ErroDaModeracao::Invalida(_) => Self::Invalido(erro.to_string()),
            ErroDaModeracao::Falha(falha) => Self::Interno(falha.0),
        }
    }
}

/// O relay manda a cópia da mensagem denunciada, assinada com o segredo em comum.
#[derive(Deserialize, ToSchema)]
pub struct CorpoDaDenuncia {
    mensagem_n: i64,
    autor_id: Uuid,
    autor_nome: String,
    texto: String,
    /// Milissegundos Unix, como o relay guarda.
    mensagem_em: i64,
    denunciante_id: Uuid,
}

#[derive(Serialize, ToSchema)]
pub struct DenunciaDaModeracao {
    mensagem_n: i64,
    autor_id: Uuid,
    autor_nome: String,
    texto: String,
    mensagem_em: DateTime<Utc>,
    denunciante_nome: String,
    criada_em: DateTime<Utc>,
}

impl From<DenunciaRecebida> for DenunciaDaModeracao {
    fn from(d: DenunciaRecebida) -> Self {
        Self {
            mensagem_n: d.denuncia.mensagem_n,
            autor_id: d.denuncia.autor_id,
            autor_nome: d.denuncia.autor_nome,
            texto: d.denuncia.texto,
            mensagem_em: d.denuncia.mensagem_em,
            denunciante_nome: d.denunciante_nome,
            criada_em: d.criada_em,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct BanidoDaModeracao {
    conta_id: Uuid,
    nome: String,
}

impl From<Banido> for BanidoDaModeracao {
    fn from(b: Banido) -> Self {
        Self {
            conta_id: b.conta_id,
            nome: b.nome,
        }
    }
}

/// Só o relay chama: guarda a denúncia de uma mensagem do chat global.
#[utoipa::path(post, path = "/moderacao/denuncias", request_body = CorpoDaDenuncia, responses((status = 204), (status = 400), (status = 401), (status = 503)))]
pub async fn denunciar(State(estado): State<EstadoDoApp>, cabecalhos: HeaderMap, corpo: Bytes) -> Result<StatusCode, ErroDaApi> {
    let texto = |nome: &str| cabecalhos.get(nome).and_then(|v| v.to_str().ok()).unwrap_or_default().to_string();
    let hora = texto(CABECALHO_DA_HORA).parse().map_err(|_| ErroDaApi::NaoAutorizado)?;
    estado.moderacao.conferir_relay(hora, &texto(CABECALHO_DA_ASSINATURA), &corpo)?;
    let corpo: CorpoDaDenuncia = serde_json::from_slice(&corpo).map_err(|_| ErroDaApi::Invalido("denúncia mal formada".into()))?;
    let mensagem_em = DateTime::from_timestamp_millis(corpo.mensagem_em).ok_or_else(|| ErroDaApi::Invalido("hora da mensagem".into()))?;
    estado
        .moderacao
        .registrar_denuncia(Denuncia {
            mensagem_n: corpo.mensagem_n,
            autor_id: corpo.autor_id,
            autor_nome: corpo.autor_nome,
            texto: corpo.texto,
            mensagem_em,
            denunciante_id: corpo.denunciante_id,
        })
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// As denúncias para a moderação, as mais novas primeiro.
#[utoipa::path(get, path = "/moderacao/denuncias", responses((status = 200, body = [DenunciaDaModeracao]), (status = 401), (status = 403)), security(("token" = [])))]
pub async fn denuncias(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<Vec<DenunciaDaModeracao>>, ErroDaApi> {
    Ok(Json(estado.moderacao.denuncias(&token).await?.into_iter().map(Into::into).collect()))
}

/// Descarta as denúncias da mensagem `n`.
#[utoipa::path(delete, path = "/moderacao/denuncias/{n}", params(("n" = i64, Path)), responses((status = 204), (status = 401), (status = 403)), security(("token" = [])))]
pub async fn resolver(State(estado): State<EstadoDoApp>, Token(token): Token, Path(n): Path<i64>) -> Result<StatusCode, ErroDaApi> {
    estado.moderacao.resolver(&token, n).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(get, path = "/moderacao/banidos", responses((status = 200, body = [BanidoDaModeracao]), (status = 401), (status = 403)), security(("token" = [])))]
pub async fn banidos(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<Vec<BanidoDaModeracao>>, ErroDaApi> {
    Ok(Json(estado.moderacao.banidos(&token).await?.into_iter().map(Into::into).collect()))
}

/// Bane a conta do chat global: ela continua lendo, mas não escreve.
#[utoipa::path(post, path = "/moderacao/banidos/{conta_id}", params(("conta_id" = Uuid, Path)), responses((status = 204), (status = 400), (status = 401), (status = 403), (status = 404)), security(("token" = [])))]
pub async fn banir(State(estado): State<EstadoDoApp>, Token(token): Token, Path(conta_id): Path<Uuid>) -> Result<StatusCode, ErroDaApi> {
    estado.moderacao.banir(&token, conta_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(delete, path = "/moderacao/banidos/{conta_id}", params(("conta_id" = Uuid, Path)), responses((status = 204), (status = 401), (status = 403)), security(("token" = [])))]
pub async fn desbanir(State(estado): State<EstadoDoApp>, Token(token): Token, Path(conta_id): Path<Uuid>) -> Result<StatusCode, ErroDaApi> {
    estado.moderacao.desbanir(&token, conta_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new()
        .route("/moderacao/denuncias", post(denunciar).get(denuncias))
        .route("/moderacao/denuncias/{n}", delete(resolver))
        .route("/moderacao/banidos", get(banidos))
        .route("/moderacao/banidos/{conta_id}", post(banir).delete(desbanir))
}
