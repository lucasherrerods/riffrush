use chrono::{DateTime, Utc};
use uuid::Uuid;

/// O mesmo limite do chat global.
pub const TAMANHO_MAXIMO_DO_TEXTO: usize = 200;
/// Quantas mensagens o histórico devolve de cada vez.
pub const MENSAGENS_POR_PAGINA: u32 = 50;
/// Mensagens que uma conta manda por minuto, somando todas as conversas.
pub const MENSAGENS_POR_MINUTO: u32 = 30;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NovaMensagem {
    pub de: Uuid,
    pub para: Uuid,
    pub texto: String,
    pub enviada_em: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MensagemPrivada {
    /// Cresce com o tempo: serve de cursor para o histórico.
    pub id: i64,
    pub de: Uuid,
    pub para: Uuid,
    pub texto: String,
    pub enviada_em: DateTime<Utc>,
}

/// Quem mandou, como o relay mostra para quem recebe.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Remetente {
    pub id: Uuid,
    pub nome: String,
    pub avatar: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NaoLidas {
    pub de: Uuid,
    pub quantas: u32,
}

/// Controles e os invisíveis que invertem a direção do texto ou escondem letras.
fn invisivel(c: char) -> bool {
    c.is_control() || matches!(c, '\u{200B}'..='\u{200F}' | '\u{202A}'..='\u{202E}' | '\u{2060}'..='\u{2069}' | '\u{FEFF}')
}

/// O texto como pode ser guardado, com as mesmas regras do chat do app, ou `None` quando não sobra nada.
pub fn limpar_texto(texto: &str) -> Option<String> {
    let sem_quebras: String = texto
        .chars()
        .map(|c| if matches!(c, '\t' | '\n' | '\r') { ' ' } else { c })
        .filter(|c| !invisivel(*c))
        .collect();
    let junto = sem_quebras.split_whitespace().collect::<Vec<_>>().join(" ");
    let cortado: String = junto.chars().take(TAMANHO_MAXIMO_DO_TEXTO).collect();
    let limpo = cortado.trim();
    (!limpo.is_empty()).then(|| limpo.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn junta_espacos_e_quebras_e_tira_as_pontas() {
        assert_eq!(limpar_texto("  oi\n\n  tudo   bem?  ").as_deref(), Some("oi tudo bem?"));
    }

    #[test]
    fn tira_os_invisiveis_e_os_controles() {
        assert_eq!(limpar_texto("o\u{202E}i\u{200B}\u{0007}").as_deref(), Some("oi"));
    }

    #[test]
    fn corta_no_tamanho_maximo_contando_letras_e_nao_bytes() {
        let texto = "é".repeat(500);
        assert_eq!(limpar_texto(&texto).unwrap().chars().count(), TAMANHO_MAXIMO_DO_TEXTO);
    }

    #[test]
    fn vazio_ou_so_espaco_nao_vira_mensagem() {
        assert_eq!(limpar_texto(""), None);
        assert_eq!(limpar_texto(" \n\t \u{200B} "), None);
    }
}
