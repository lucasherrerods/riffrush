//! Partes puras do servidor da sala: o anúncio na rede, o envelope das mensagens
//! e o caminho dos arquivos do jogo servidos ao navegador do celular.

use serde::{Deserialize, Serialize};

pub const PORTA_DA_SALA: u16 = 7777;
pub const PORTA_DO_ANUNCIO: u16 = 7778;
pub const MAXIMO_DE_JOGADORES: usize = 4;
/// Quem cria a sala na LAN entra primeiro e recebe o id 1. Na LAN não há troca de host.
pub const HOST: usize = 1;
/// Os mesmos limites do relay: a maior mensagem do jogo é a lista da sala, bem abaixo disso.
pub const TAMANHO_MAXIMO_DA_MENSAGEM: usize = 8 * 1024;
pub const LIMITE_DE_MENSAGENS_POR_SEGUNDO: u32 = 20;
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
/// Só repassa JSON válido e de tamanho razoável.
pub fn embrulhar(de: usize, mensagem: &str) -> Option<String> {
    if mensagem.len() > TAMANHO_MAXIMO_DA_MENSAGEM {
        return None;
    }
    serde_json::from_str::<serde_json::Value>(mensagem).ok()?;
    Some(format!(r#"{{"de":{de},"msg":{mensagem}}}"#))
}

/// A mensagem embrulhada é o host expulsando `id`: quem foi expulso recebe o aviso e é desconectado.
/// Só esconder no app não basta: conectado, ele continuaria lendo o chat e o placar.
pub fn expulsa(embrulhada: &str, id: usize) -> bool {
    #[derive(Deserialize)]
    struct Envelope {
        de: usize,
        msg: Pedido,
    }
    #[derive(Deserialize)]
    struct Pedido {
        tipo: String,
        id: Option<usize>,
    }
    id != HOST
        && serde_json::from_str::<Envelope>(embrulhada)
            .is_ok_and(|e| e.de == HOST && e.msg.tipo == "expulsar" && e.msg.id == Some(id))
}

/// Limite por conexão, em janelas de 1 s: um celular com o app modificado não inunda a sala.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Janela {
    pub inicio_ms: u128,
    pub contagem: u32,
}

pub fn dentro_do_limite(janela: Janela, agora_ms: u128) -> (bool, Janela) {
    if janela.contagem == 0 || agora_ms.saturating_sub(janela.inicio_ms) >= 1000 {
        return (true, Janela { inicio_ms: agora_ms, contagem: 1 });
    }
    if janela.contagem >= LIMITE_DE_MENSAGENS_POR_SEGUNDO {
        return (false, janela);
    }
    (true, Janela { contagem: janela.contagem + 1, ..janela })
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
    fn nao_repassa_mensagem_grande_demais() {
        let grande = format!(r#"{{"texto":"{}"}}"#, "a".repeat(TAMANHO_MAXIMO_DA_MENSAGEM));
        assert_eq!(embrulhar(2, &grande), None);
    }

    #[test]
    fn o_host_expulsa_e_o_expulso_e_desconectado() {
        let expulsar = embrulhar(HOST, r#"{"tipo":"expulsar","id":3}"#).unwrap();
        assert!(expulsa(&expulsar, 3));
        assert!(!expulsa(&expulsar, 2));
    }

    #[test]
    fn convidado_nao_expulsa_ninguem_e_ninguem_expulsa_o_host() {
        assert!(!expulsa(&embrulhar(2, r#"{"tipo":"expulsar","id":3}"#).unwrap(), 3));
        assert!(!expulsa(&embrulhar(HOST, r#"{"tipo":"expulsar","id":1}"#).unwrap(), HOST));
        assert!(!expulsa(&embrulhar(HOST, r#"{"tipo":"chat","texto":"expulsar 3"}"#).unwrap(), 3));
    }

    #[test]
    fn limita_as_mensagens_por_segundo() {
        let mut janela = Janela::default();
        for _ in 0..LIMITE_DE_MENSAGENS_POR_SEGUNDO {
            let (passa, nova) = dentro_do_limite(janela, 5_000);
            assert!(passa);
            janela = nova;
        }
        assert!(!dentro_do_limite(janela, 5_999).0);
        assert!(dentro_do_limite(janela, 6_000).0);
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
