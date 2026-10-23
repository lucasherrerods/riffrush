use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

/// O único lugar onde erros viram resposta HTTP. Os módulos convertem os erros do domínio para este.
#[derive(Debug, thiserror::Error)]
pub enum ErroDaApi {
    #[error("{0}")]
    Invalido(String),
    #[error("não autorizado")]
    NaoAutorizado,
    #[error("não encontrado")]
    NaoEncontrado,
    #[error("serviço indisponível")]
    Indisponivel,
    #[error("erro interno")]
    Interno(String),
}

impl ErroDaApi {
    fn status(&self) -> StatusCode {
        match self {
            Self::Invalido(_) => StatusCode::BAD_REQUEST,
            Self::NaoAutorizado => StatusCode::UNAUTHORIZED,
            Self::NaoEncontrado => StatusCode::NOT_FOUND,
            Self::Indisponivel => StatusCode::SERVICE_UNAVAILABLE,
            Self::Interno(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for ErroDaApi {
    fn into_response(self) -> Response {
        // O detalhe do erro interno vai para o log, nunca para o cliente.
        if let Self::Interno(detalhe) = &self {
            tracing::error!(%detalhe, "erro interno");
        }
        (self.status(), Json(json!({ "erro": self.to_string() }))).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cada_erro_tem_seu_status() {
        assert_eq!(ErroDaApi::Invalido("x".into()).status(), StatusCode::BAD_REQUEST);
        assert_eq!(ErroDaApi::NaoAutorizado.status(), StatusCode::UNAUTHORIZED);
        assert_eq!(ErroDaApi::Indisponivel.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[test]
    fn erro_interno_nao_vaza_o_detalhe() {
        assert_eq!(ErroDaApi::Interno("senha do banco".into()).to_string(), "erro interno");
    }
}
