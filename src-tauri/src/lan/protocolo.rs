//! Partes puras do servidor da sala: o anúncio na rede, o envelope das mensagens
//! e o caminho dos arquivos do jogo servidos ao navegador do celular.

use serde::{Deserialize, Serialize};

pub const PORTA_DA_SALA: u16 = 7777;
pub const PORTA_DO_ANUNCIO: u16 = 7778;
pub const MAXIMO_DE_JOGADORES: usize = 4;
const VERSAO_DO_ANUNCIO: u8 = 1;

/// O que a sala anuncia na rede para outros apps a encontrarem.
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct Anuncio {
    pub riffrush: u8,
    pub nome: String,
    pub porta: u16,
    pub jogadores: usize,
}

impl Anuncio {
    pub fn novo(nome: &str, jogadores: usize) -> Self {
        Self { riffrush: VERSAO_DO_ANUNCIO, nome: nome.to_string(), porta: PORTA_DA_SALA, jogadores }
    }
}

/// Lê um anúncio recebido na rede; ignora mensagens de outros programas.
pub fn ler_anuncio(bytes: &[u8]) -> Option<Anuncio> {
    serde_json::from_slice::<Anuncio>(bytes).ok().filter(|a| a.riffrush == VERSAO_DO_ANUNCIO)
}

/// Embrulha a mensagem de um jogador para repassar a todos: `{"de": id, "msg": ...}`.
/// Só repassa JSON válido.
pub fn embrulhar(de: usize, mensagem: &str) -> Option<String> {
    serde_json::from_str::<serde_json::Value>(mensagem).ok()?;
    Some(format!(r#"{{"de":{de},"msg":{mensagem}}}"#))
}

/// Caminho do arquivo do jogo pedido pelo navegador; a raiz e as rotas desconhecidas viram index.html.
pub fn caminho_do_arquivo(caminho_da_url: &str) -> &str {
    match caminho_da_url.trim_start_matches('/') {
        "" => "index.html",
        caminho => caminho,
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn anuncio_vai_e_volta_pela_rede() {
        let anuncio = Anuncio::novo("Lucas", 2);
        let bytes = serde_json::to_vec(&anuncio).unwrap();
        assert_eq!(ler_anuncio(&bytes), Some(anuncio));
    }

    #[test]
    fn anuncio_usa_a_porta_da_sala() {
        assert_eq!(Anuncio::novo("x", 0).porta, PORTA_DA_SALA);
    }

    #[test]
    fn ignora_anuncio_de_outra_versao() {
        let bytes = br#"{"riffrush":2,"nome":"x","porta":7777,"jogadores":1}"#;
        assert_eq!(ler_anuncio(bytes), None);
    }

    #[test]
    fn ignora_lixo_da_rede() {
        assert_eq!(ler_anuncio(b"qualquer coisa"), None);
    }

    #[test]
    fn embrulha_a_mensagem_com_quem_mandou() {
        assert_eq!(
            embrulhar(3, r#"{"tipo":"oi"}"#).as_deref(),
            Some(r#"{"de":3,"msg":{"tipo":"oi"}}"#)
        );
    }

    #[test]
    fn nao_repassa_mensagem_que_nao_e_json() {
        assert_eq!(embrulhar(1, "isso não é json"), None);
    }

    #[test]
    fn raiz_vira_index() {
        assert_eq!(caminho_do_arquivo("/"), "index.html");
        assert_eq!(caminho_do_arquivo(""), "index.html");
    }

    #[test]
    fn arquivos_perdem_a_barra_inicial() {
        assert_eq!(caminho_do_arquivo("/assets/jogo.js"), "assets/jogo.js");
    }
}
