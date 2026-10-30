use base64::prelude::{Engine, BASE64_URL_SAFE_NO_PAD};
use chrono::{DateTime, Duration, Utc};
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
    /// O relay só deixa escrever no chat global a partir de um nível mínimo.
    pub nivel: u32,
    /// Da moderação: modera o chat global e aparece com o selo.
    pub admin: bool,
    /// Banido do chat global: lê, mas não escreve.
    pub banido: bool,
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

/// Fichas por minuto para a mesma conta. O app pede uma a cada conexão (presença, chat, transmissão)
/// e a cada reconexão; mais que isso é alguém martelando a rota.
pub const FICHAS_POR_MINUTO: u32 = 20;

pub use crate::shared::limite::Janela;

/// Janela de um minuto por conta: devolve se a ficha pode sair e a janela atualizada.
pub fn dentro_do_limite(janela: Option<Janela>, agora: DateTime<Utc>) -> (bool, Janela) {
    crate::shared::limite::dentro_do_limite(janela, agora, FICHAS_POR_MINUTO, Duration::minutes(1))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limita_as_fichas_por_minuto_da_mesma_conta() {
        let agora = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
        let mut janela = None;
        for _ in 0..FICHAS_POR_MINUTO {
            let (passa, nova) = dentro_do_limite(janela, agora);
            assert!(passa);
            janela = Some(nova);
        }
        assert!(!dentro_do_limite(janela, agora + Duration::seconds(59)).0);
        assert!(dentro_do_limite(janela, agora + Duration::seconds(60)).0);
    }

    /// O mesmo valor está no teste do relay (backend/relay/src/presenca.test.ts): os dois lados precisam concordar.
    const FICHA_DE_EXEMPLO: &str = "eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwNyIsIm5vbWUiOiJMdWNhcyIsImF2YXRhciI6bnVsbCwibml2ZWwiOjMsImFkbWluIjpmYWxzZSwiYmFuaWRvIjpmYWxzZSwiZXhwIjoxOTAwMDAwMDAwfQ.9401CmmfteL1hrpnUWwo073vskes2uCyA8VskxNS7Ls";

    #[test]
    fn assina_a_ficha_no_formato_que_o_relay_confere() {
        let ficha = Ficha {
            id: Uuid::from_u128(7),
            nome: "Lucas".into(),
            avatar: None,
            nivel: 3,
            admin: false,
            banido: false,
            exp: 1_900_000_000,
        };
        assert_eq!(assinar_ficha(&ficha, b"segredo-de-teste"), FICHA_DE_EXEMPLO);
        assert_ne!(assinar_ficha(&ficha, b"outro"), FICHA_DE_EXEMPLO);
    }
}
