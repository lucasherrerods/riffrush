use chrono::{DateTime, Utc};
use uuid::Uuid;

/// O mesmo limite do chat global.
pub const TAMANHO_MAXIMO_DO_TEXTO: usize = 200;
/// Quantas mensagens o histórico devolve de cada vez.
pub const MENSAGENS_POR_PAGINA: u32 = 50;
/// Mensagens que uma conta manda por minuto, somando todas as conversas.
pub const MENSAGENS_POR_MINUTO: u32 = 30;

/// Tamanhos das partes de uma sugestão de música.
pub const TAMANHO_MAXIMO_DO_TITULO: usize = 120;
pub const TAMANHO_MAXIMO_DA_DIFICULDADE: usize = 60;
pub const TAMANHO_MAXIMO_DA_VERSAO: usize = 40;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModoDaSugestao {
    Rock,
    Mania,
}

impl ModoDaSugestao {
    pub fn como_texto(self) -> &'static str {
        match self {
            Self::Rock => "rock",
            Self::Mania => "mania",
        }
    }

    pub fn do_texto(texto: &str) -> Option<Self> {
        match texto {
            "rock" => Some(Self::Rock),
            "mania" => Some(Self::Mania),
            _ => None,
        }
    }
}

/// Uma música para o amigo tocar. Só vale o que ele consegue baixar: um chart do Encore no Rock
/// (pelo md5) ou um conjunto do osu! no Mania (pelo id do conjunto).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SugestaoDeMusica {
    pub modo: ModoDaSugestao,
    pub musica: String,
    /// A dificuldade escolhida, para o jogo deixá-la marcada (no Mania, o id do beatmap).
    pub versao: Option<String>,
    pub titulo: String,
    pub artista: String,
    /// Como a dificuldade aparece no cartão.
    pub dificuldade: String,
}

fn id_da_musica_valido(modo: ModoDaSugestao, musica: &str) -> bool {
    match modo {
        ModoDaSugestao::Rock => musica.len() == 32 && musica.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
        ModoDaSugestao::Mania => (1..=12).contains(&musica.len()) && musica.bytes().all(|b| b.is_ascii_digit()),
    }
}

fn versao_valida(versao: &str) -> bool {
    (1..=TAMANHO_MAXIMO_DA_VERSAO).contains(&versao.len()) && versao.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// O texto curto limpo com as regras do chat e cortado no tamanho dado; pode ficar vazio.
fn texto_curto(texto: &str, tamanho: usize) -> String {
    let limpo: String = texto.chars().map(|c| if invisivel(c) { ' ' } else { c }).collect();
    let junto = limpo.split_whitespace().collect::<Vec<_>>().join(" ");
    junto.chars().take(tamanho).collect::<String>().trim().to_string()
}

/// A sugestão como pode ser guardada, ou `None` quando ela não aponta para uma música que dê para baixar.
pub fn limpar_sugestao(sugestao: SugestaoDeMusica) -> Option<SugestaoDeMusica> {
    let musica = sugestao.musica.trim().to_ascii_lowercase();
    if !id_da_musica_valido(sugestao.modo, &musica) {
        return None;
    }
    let versao = match sugestao.versao.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
        Some(versao) if versao_valida(versao) => Some(versao.to_string()),
        Some(_) => return None,
        None => None,
    };
    let titulo = texto_curto(&sugestao.titulo, TAMANHO_MAXIMO_DO_TITULO);
    if titulo.is_empty() {
        return None;
    }
    Some(SugestaoDeMusica {
        modo: sugestao.modo,
        musica,
        versao,
        titulo,
        artista: texto_curto(&sugestao.artista, TAMANHO_MAXIMO_DO_TITULO),
        dificuldade: texto_curto(&sugestao.dificuldade, TAMANHO_MAXIMO_DA_DIFICULDADE),
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NovaMensagem {
    pub de: Uuid,
    pub para: Uuid,
    /// Com uma sugestão, o recado pode ficar vazio.
    pub texto: String,
    pub sugestao: Option<SugestaoDeMusica>,
    pub enviada_em: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MensagemPrivada {
    /// Cresce com o tempo: serve de cursor para o histórico.
    pub id: i64,
    pub de: Uuid,
    pub para: Uuid,
    pub texto: String,
    pub sugestao: Option<SugestaoDeMusica>,
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

    fn sugestao(modo: ModoDaSugestao, musica: &str) -> SugestaoDeMusica {
        SugestaoDeMusica {
            modo,
            musica: musica.into(),
            versao: Some("expert".into()),
            titulo: "  Through the\nFire  ".into(),
            artista: "DragonForce".into(),
            dificuldade: "Expert · Guitarra".into(),
        }
    }

    #[test]
    fn a_sugestao_do_rock_aponta_para_um_md5_do_encore() {
        let limpa = limpar_sugestao(sugestao(ModoDaSugestao::Rock, "FB0079D4C2E025D5B8DD70724750A923")).unwrap();
        assert_eq!(limpa.musica, "fb0079d4c2e025d5b8dd70724750a923");
        assert_eq!(limpa.titulo, "Through the Fire");
        assert!(limpar_sugestao(sugestao(ModoDaSugestao::Rock, "arquivo:minha-musica")).is_none());
        assert!(limpar_sugestao(sugestao(ModoDaSugestao::Rock, "123")).is_none());
    }

    #[test]
    fn a_sugestao_do_mania_aponta_para_um_conjunto_do_osu() {
        assert!(limpar_sugestao(sugestao(ModoDaSugestao::Mania, "1234567")).is_some());
        assert!(limpar_sugestao(sugestao(ModoDaSugestao::Mania, "12a")).is_none());
        assert!(limpar_sugestao(sugestao(ModoDaSugestao::Mania, "")).is_none());
    }

    #[test]
    fn a_sugestao_precisa_de_titulo_e_de_uma_versao_simples() {
        let sem_titulo = SugestaoDeMusica {
            titulo: " \u{200B} ".into(),
            ..sugestao(ModoDaSugestao::Mania, "1")
        };
        assert!(limpar_sugestao(sem_titulo).is_none());
        let versao_estranha = SugestaoDeMusica {
            versao: Some("<script>".into()),
            ..sugestao(ModoDaSugestao::Mania, "1")
        };
        assert!(limpar_sugestao(versao_estranha).is_none());
        let sem_versao = SugestaoDeMusica {
            versao: Some("  ".into()),
            ..sugestao(ModoDaSugestao::Mania, "1")
        };
        assert_eq!(limpar_sugestao(sem_versao).unwrap().versao, None);
    }

    #[test]
    fn os_textos_da_sugestao_sao_cortados() {
        let longa = SugestaoDeMusica {
            titulo: "a".repeat(500),
            dificuldade: "b".repeat(500),
            ..sugestao(ModoDaSugestao::Mania, "1")
        };
        let limpa = limpar_sugestao(longa).unwrap();
        assert_eq!(limpa.titulo.chars().count(), TAMANHO_MAXIMO_DO_TITULO);
        assert_eq!(limpa.dificuldade.chars().count(), TAMANHO_MAXIMO_DA_DIFICULDADE);
    }

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
