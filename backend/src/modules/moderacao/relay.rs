use std::sync::Arc;

use async_trait::async_trait;
use serde_json::json;

use super::dominio::assinar_pedido;
use super::portas::{AvisoAoRelay, AvisoDeModeracao};
use crate::modules::conta::{FalhaExterna, Relogio};

pub const CABECALHO_DA_HORA: &str = "x-riffrush-hora";
pub const CABECALHO_DA_ASSINATURA: &str = "x-riffrush-assinatura";

/// Avisa o relay pela rota `/chat/moderacao`, com o pedido assinado pelo segredo em comum.
pub struct RelayHttp {
    pub http: reqwest::Client,
    /// O mesmo endereço do app (`wss://...`); sem ele, o aviso não sai e o banimento vale na próxima conexão.
    pub url: Option<String>,
    pub segredo: Option<Arc<Vec<u8>>>,
    pub relogio: Arc<dyn Relogio>,
}

/// O relay recebe WebSocket em `wss://` e HTTP comum em `https://`, no mesmo endereço.
pub fn endereco_http(url_do_relay: &str) -> String {
    let sem_barra = url_do_relay.trim_end_matches('/');
    if let Some(resto) = sem_barra.strip_prefix("wss://") {
        format!("https://{resto}")
    } else if let Some(resto) = sem_barra.strip_prefix("ws://") {
        format!("http://{resto}")
    } else {
        sem_barra.to_string()
    }
}

#[async_trait]
impl AvisoAoRelay for RelayHttp {
    async fn avisar(&self, aviso: AvisoDeModeracao) -> Result<(), FalhaExterna> {
        let (Some(url), Some(segredo)) = (&self.url, &self.segredo) else {
            return Ok(());
        };
        let corpo = match aviso {
            AvisoDeModeracao::Banir(id) => json!({ "tipo": "banir", "id": id }),
            AvisoDeModeracao::Desbanir(id) => json!({ "tipo": "desbanir", "id": id }),
        }
        .to_string();
        let hora = self.relogio.agora().timestamp();
        let resposta = self
            .http
            .post(format!("{}/chat/moderacao", endereco_http(url)))
            .header(CABECALHO_DA_HORA, hora.to_string())
            .header(CABECALHO_DA_ASSINATURA, assinar_pedido(segredo, hora, corpo.as_bytes()))
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(corpo)
            .send()
            .await
            .map_err(|e| FalhaExterna(e.to_string()))?;
        if !resposta.status().is_success() {
            return Err(FalhaExterna(format!("o relay respondeu {}", resposta.status())));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn troca_o_websocket_pelo_http_do_mesmo_endereco() {
        assert_eq!(endereco_http("wss://relay.exemplo.dev/"), "https://relay.exemplo.dev");
        assert_eq!(endereco_http("ws://127.0.0.1:8799"), "http://127.0.0.1:8799");
        assert_eq!(endereco_http("https://relay.exemplo.dev"), "https://relay.exemplo.dev");
    }
}
