use std::sync::Arc;

use async_trait::async_trait;
use serde_json::json;

use super::dominio::{MensagemPrivada, Remetente};
use super::portas::EntregaNaHora;
use crate::modules::conta::FalhaExterna;
use crate::modules::moderacao::RelayHttp;

/// Pede ao relay, pela rota `/privada`, que entregue a mensagem a quem mandou e a quem recebe.
pub struct EntregaPeloRelay(pub Arc<RelayHttp>);

pub fn corpo_da_entrega(mensagem: &MensagemPrivada, remetente: &Remetente) -> String {
    json!({
        "id": mensagem.id,
        "de": { "id": remetente.id, "nome": remetente.nome, "avatar": remetente.avatar },
        "para": mensagem.para,
        "texto": mensagem.texto,
        "em": mensagem.enviada_em.timestamp_millis(),
    })
    .to_string()
}

#[async_trait]
impl EntregaNaHora for EntregaPeloRelay {
    async fn entregar(&self, mensagem: &MensagemPrivada, remetente: &Remetente) -> Result<(), FalhaExterna> {
        self.0.postar("/privada", corpo_da_entrega(mensagem, remetente)).await
    }
}

#[cfg(test)]
mod tests {
    use chrono::{TimeZone, Utc};
    use serde_json::Value;
    use uuid::Uuid;

    use super::*;

    #[test]
    fn o_corpo_leva_quem_mandou_e_a_hora_em_ms() {
        let de = Uuid::new_v4();
        let para = Uuid::new_v4();
        let mensagem = MensagemPrivada {
            id: 7,
            de,
            para,
            texto: "oi".into(),
            enviada_em: Utc.timestamp_millis_opt(1_700_000_000_123).unwrap(),
        };
        let remetente = Remetente {
            id: de,
            nome: "Ana".into(),
            avatar: None,
        };
        let corpo: Value = serde_json::from_str(&corpo_da_entrega(&mensagem, &remetente)).unwrap();
        assert_eq!(
            corpo,
            json!({ "id": 7, "de": { "id": de, "nome": "Ana", "avatar": null }, "para": para, "texto": "oi", "em": 1_700_000_000_123i64 })
        );
    }
}
