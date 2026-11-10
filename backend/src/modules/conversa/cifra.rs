//! Cifra do texto das mensagens privadas guardadas no banco (AES-256-GCM).
//! Cada mensagem leva um nonce próprio, gravado na frente do texto cifrado.

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::{engine::general_purpose::STANDARD, Engine};

const TAMANHO_DO_NONCE: usize = 12;

#[derive(Debug, thiserror::Error, PartialEq)]
pub enum ErroDaCifra {
    #[error("a chave precisa ser 32 bytes em base64")]
    ChaveInvalida,
    #[error("a mensagem cifrada não confere com a chave")]
    NaoDecifrou,
}

pub struct CifraDasMensagens(Aes256Gcm);

impl CifraDasMensagens {
    /// A chave vem em base64, como na variável `CHAVE_DAS_MENSAGENS` (`openssl rand -base64 32`).
    pub fn da_chave(base64: &str) -> Result<Self, ErroDaCifra> {
        let bytes = STANDARD.decode(base64.trim()).map_err(|_| ErroDaCifra::ChaveInvalida)?;
        if bytes.len() != 32 {
            return Err(ErroDaCifra::ChaveInvalida);
        }
        Ok(Self(Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&bytes))))
    }

    pub fn cifrar(&self, texto: &str) -> Vec<u8> {
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let mut saida = nonce.to_vec();
        // Só falha com textos de gigabytes; o domínio limita a 200 caracteres.
        saida.extend(self.0.encrypt(&nonce, texto.as_bytes()).unwrap_or_default());
        saida
    }

    pub fn decifrar(&self, cifrado: &[u8]) -> Result<String, ErroDaCifra> {
        if cifrado.len() < TAMANHO_DO_NONCE {
            return Err(ErroDaCifra::NaoDecifrou);
        }
        let (nonce, corpo) = cifrado.split_at(TAMANHO_DO_NONCE);
        let aberto = self.0.decrypt(Nonce::from_slice(nonce), corpo).map_err(|_| ErroDaCifra::NaoDecifrou)?;
        String::from_utf8(aberto).map_err(|_| ErroDaCifra::NaoDecifrou)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CHAVE: &str = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
    const OUTRA: &str = "HwAdHBsaGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQA=";

    #[test]
    fn cifra_e_decifra_o_texto() {
        let cifra = CifraDasMensagens::da_chave(CHAVE).unwrap();
        let cifrado = cifra.cifrar("bora jogar? 🎸");
        assert!(!String::from_utf8_lossy(&cifrado).contains("bora"));
        assert_eq!(cifra.decifrar(&cifrado).unwrap(), "bora jogar? 🎸");
    }

    #[test]
    fn o_mesmo_texto_cifrado_duas_vezes_sai_diferente() {
        let cifra = CifraDasMensagens::da_chave(CHAVE).unwrap();
        assert_ne!(cifra.cifrar("oi"), cifra.cifrar("oi"));
    }

    #[test]
    fn outra_chave_nao_decifra() {
        let cifrado = CifraDasMensagens::da_chave(CHAVE).unwrap().cifrar("oi");
        let outra = CifraDasMensagens::da_chave(OUTRA).unwrap();
        assert_eq!(outra.decifrar(&cifrado), Err(ErroDaCifra::NaoDecifrou));
    }

    #[test]
    fn mensagem_alterada_ou_curta_nao_decifra() {
        let cifra = CifraDasMensagens::da_chave(CHAVE).unwrap();
        let mut cifrado = cifra.cifrar("oi");
        *cifrado.last_mut().unwrap() ^= 1;
        assert_eq!(cifra.decifrar(&cifrado), Err(ErroDaCifra::NaoDecifrou));
        assert_eq!(cifra.decifrar(&[1, 2, 3]), Err(ErroDaCifra::NaoDecifrou));
    }

    #[test]
    fn chave_que_nao_tem_32_bytes_e_recusada() {
        assert!(CifraDasMensagens::da_chave("curta").is_err());
        assert!(CifraDasMensagens::da_chave("AAECAwQFBgcICQoLDA0ODw==").is_err());
    }
}
