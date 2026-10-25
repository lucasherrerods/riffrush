use base64::prelude::{Engine, BASE64_URL_SAFE_NO_PAD};
use hmac::{Hmac, Mac};
use serde::Serialize;
use sha2::Sha256;
use uuid::Uuid;

/// A ficha só vale para abrir a conexão com o relay; depois disso a conexão segue aberta.
pub const VALIDADE_DA_FICHA_EM_SEGUNDOS: i64 = 5 * 60;

/// Quem a pessoa é, para o relay mostrar na lista de quem está online.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Ficha {
    pub id: Uuid,
    pub nome: String,
    pub avatar: Option<String>,
    /// Segundos Unix.
    pub exp: i64,
}

/// `base64url(json).base64url(hmac-sha256)`. O relay confere com o mesmo segredo.
pub fn assinar_ficha(ficha: &Ficha, segredo: &[u8]) -> String {
    let corpo = BASE64_URL_SAFE_NO_PAD.encode(serde_json::to_vec(ficha).unwrap_or_default());
    let mut mac = Hmac::<Sha256>::new_from_slice(segredo).unwrap_or_else(|_| unreachable!("HMAC aceita chave de qualquer tamanho"));
    mac.update(corpo.as_bytes());
    format!("{corpo}.{}", BASE64_URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// O mesmo valor está no teste do relay (backend/relay/src/presenca.test.ts): os dois lados precisam concordar.
    const FICHA_DE_EXEMPLO: &str = "eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwNyIsIm5vbWUiOiJMdWNhcyIsImF2YXRhciI6bnVsbCwiZXhwIjoxOTAwMDAwMDAwfQ.g3x_8V8_Mc8fiEU3TwanHW2LnkX5ipNmEHy9XUb6HhA";

    #[test]
    fn assina_a_ficha_no_formato_que_o_relay_confere() {
        let ficha = Ficha {
            id: Uuid::from_u128(7),
            nome: "Lucas".into(),
            avatar: None,
            exp: 1_900_000_000,
        };
        assert_eq!(assinar_ficha(&ficha, b"segredo-de-teste"), FICHA_DE_EXEMPLO);
        assert_ne!(assinar_ficha(&ficha, b"outro"), FICHA_DE_EXEMPLO);
    }
}
