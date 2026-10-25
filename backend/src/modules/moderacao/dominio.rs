use base64::prelude::{Engine, BASE64_URL_SAFE_NO_PAD};
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use uuid::Uuid;

/// O que a conta pode no chat global. Vai assinado na ficha para o relay.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Situacao {
    pub admin: bool,
    pub banido: bool,
}

/// Uma mensagem denunciada, com a cópia do que estava escrito.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Denuncia {
    pub mensagem_n: i64,
    pub autor_id: Uuid,
    pub autor_nome: String,
    pub texto: String,
    pub mensagem_em: DateTime<Utc>,
    pub denunciante_id: Uuid,
}

/// Para a tela da moderação: a denúncia com o nome de quem denunciou.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DenunciaRecebida {
    pub denuncia: Denuncia,
    pub denunciante_nome: String,
    pub criada_em: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Banido {
    pub conta_id: Uuid,
    pub nome: String,
}

/// O que a moderação vê de uma vez.
pub const DENUNCIAS_NA_TELA: u32 = 200;
/// Os mesmos limites do chat (backend/relay/src/chat.ts).
pub const TAMANHO_MAXIMO_DO_TEXTO: usize = 200;
pub const TAMANHO_MAXIMO_DO_NOME: usize = 80;

#[derive(Debug, PartialEq, Eq, thiserror::Error)]
#[error("denúncia inválida: {0}")]
pub struct DenunciaInvalida(pub &'static str);

impl Denuncia {
    /// Só o relay manda denúncias, mas ele também pode ter bug: os limites valem aqui.
    pub fn validar(self) -> Result<Self, DenunciaInvalida> {
        if self.mensagem_n <= 0 {
            return Err(DenunciaInvalida("número da mensagem"));
        }
        if self.texto.trim().is_empty() || self.texto.chars().count() > TAMANHO_MAXIMO_DO_TEXTO {
            return Err(DenunciaInvalida("texto"));
        }
        if self.autor_nome.trim().is_empty() || self.autor_nome.chars().count() > TAMANHO_MAXIMO_DO_NOME {
            return Err(DenunciaInvalida("nome"));
        }
        if self.autor_id == self.denunciante_id {
            return Err(DenunciaInvalida("denunciou a própria mensagem"));
        }
        Ok(self)
    }
}

/// Pedido entre o relay e a API vale por esse tempo: um pedido copiado não serve depois.
pub const VALIDADE_DO_PEDIDO_EM_SEGUNDOS: i64 = 5 * 60;

/// `base64url(hmac-sha256(segredo, "{hora}.{corpo}"))`. O relay assina e confere do mesmo jeito.
pub fn assinar_pedido(segredo: &[u8], hora: i64, corpo: &[u8]) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(segredo).unwrap_or_else(|_| unreachable!("HMAC aceita chave de qualquer tamanho"));
    mac.update(hora.to_string().as_bytes());
    mac.update(b".");
    mac.update(corpo);
    BASE64_URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes())
}

/// O pedido veio do relay (mesmo segredo) e é recente.
pub fn pedido_confere(segredo: &[u8], hora: i64, agora: i64, corpo: &[u8], assinatura: &str) -> bool {
    if (agora - hora).abs() > VALIDADE_DO_PEDIDO_EM_SEGUNDOS {
        return false;
    }
    let Ok(recebida) = BASE64_URL_SAFE_NO_PAD.decode(assinatura) else {
        return false;
    };
    let mut mac = Hmac::<Sha256>::new_from_slice(segredo).unwrap_or_else(|_| unreachable!("HMAC aceita chave de qualquer tamanho"));
    mac.update(hora.to_string().as_bytes());
    mac.update(b".");
    mac.update(corpo);
    // Comparação em tempo constante.
    mac.verify_slice(&recebida).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// O mesmo valor está no teste do relay (backend/relay/src/assinatura.test.ts): os dois lados precisam concordar.
    const ASSINATURA_DE_EXEMPLO: &str = "WMGSmjB_GSo12gmWNGJr3IcGHkQIsO9CV5f5-DZC_V8";

    fn denuncia() -> Denuncia {
        Denuncia {
            mensagem_n: 7,
            autor_id: Uuid::from_u128(1),
            autor_nome: "Ana".into(),
            texto: "spam".into(),
            mensagem_em: DateTime::from_timestamp(1_800_000_000, 0).unwrap(),
            denunciante_id: Uuid::from_u128(2),
        }
    }

    #[test]
    fn assina_no_formato_que_o_relay_confere() {
        assert_eq!(assinar_pedido(b"segredo-de-teste", 1_800_000_000, br#"{"oi":1}"#), ASSINATURA_DE_EXEMPLO);
    }

    #[test]
    fn confere_o_pedido_assinado_e_recente() {
        let assinatura = assinar_pedido(b"s", 1_000, b"corpo");
        assert!(pedido_confere(b"s", 1_000, 1_100, b"corpo", &assinatura));
        assert!(!pedido_confere(b"outro", 1_000, 1_100, b"corpo", &assinatura));
        assert!(!pedido_confere(b"s", 1_000, 1_100, b"corpo mudado", &assinatura));
        assert!(!pedido_confere(b"s", 1_000, 1_000 + VALIDADE_DO_PEDIDO_EM_SEGUNDOS + 1, b"corpo", &assinatura));
        assert!(!pedido_confere(b"s", 1_000, 1_100, b"corpo", "lixo!"));
    }

    #[test]
    fn valida_os_limites_da_denuncia() {
        assert!(denuncia().validar().is_ok());
        assert!(Denuncia {
            texto: "a".repeat(201),
            ..denuncia()
        }
        .validar()
        .is_err());
        assert!(Denuncia {
            texto: "  ".into(),
            ..denuncia()
        }
        .validar()
        .is_err());
        assert!(Denuncia {
            autor_nome: "a".repeat(81),
            ..denuncia()
        }
        .validar()
        .is_err());
        assert!(Denuncia { mensagem_n: 0, ..denuncia() }.validar().is_err());
        assert!(Denuncia {
            denunciante_id: Uuid::from_u128(1),
            ..denuncia()
        }
        .validar()
        .is_err());
    }
}
