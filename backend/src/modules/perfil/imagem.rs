//! As imagens que a pessoa escolhe para o perfil. O app já manda a imagem reduzida; aqui só se confere.

use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TipoDeImagem {
    Foto,
    Capa,
}

impl TipoDeImagem {
    pub fn texto(self) -> &'static str {
        match self {
            Self::Foto => "foto",
            Self::Capa => "capa",
        }
    }

    pub fn do_texto(texto: &str) -> Option<Self> {
        match texto {
            "foto" => Some(Self::Foto),
            "capa" => Some(Self::Capa),
            _ => None,
        }
    }

    /// O app manda a foto com 256 px e a capa com 1500 x 500; isso deixa folga para JPEG e PNG.
    pub fn tamanho_maximo(self) -> usize {
        match self {
            Self::Foto => 256 * 1024,
            Self::Capa => 1024 * 1024,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FormatoDaImagem {
    Webp,
    Jpeg,
    Png,
}

impl FormatoDaImagem {
    /// Pelos primeiros bytes do arquivo, e não pelo que o cliente diz que mandou.
    pub fn dos_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
            Some(Self::Webp)
        } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
            Some(Self::Jpeg)
        } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
            Some(Self::Png)
        } else {
            None
        }
    }

    pub fn texto(self) -> &'static str {
        match self {
            Self::Webp => "image/webp",
            Self::Jpeg => "image/jpeg",
            Self::Png => "image/png",
        }
    }

    pub fn do_texto(texto: &str) -> Option<Self> {
        [Self::Webp, Self::Jpeg, Self::Png].into_iter().find(|f| f.texto() == texto)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Imagem {
    pub formato: FormatoDaImagem,
    pub conteudo: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum ErroDaImagem {
    #[error("a imagem está vazia")]
    Vazia,
    #[error("a imagem é grande demais")]
    Grande,
    #[error("a imagem precisa ser WebP, JPEG ou PNG")]
    FormatoDesconhecido,
}

pub fn validar_imagem(tipo: TipoDeImagem, conteudo: Vec<u8>) -> Result<Imagem, ErroDaImagem> {
    if conteudo.is_empty() {
        return Err(ErroDaImagem::Vazia);
    }
    if conteudo.len() > tipo.tamanho_maximo() {
        return Err(ErroDaImagem::Grande);
    }
    let formato = FormatoDaImagem::dos_bytes(&conteudo).ok_or(ErroDaImagem::FormatoDesconhecido)?;
    Ok(Imagem { formato, conteudo })
}

/// Trocar de imagem a toda hora só enche o banco.
pub const INTERVALO_ENTRE_TROCAS: Duration = Duration::seconds(10);

pub fn pode_trocar(ultima: Option<DateTime<Utc>>, agora: DateTime<Utc>) -> bool {
    ultima.is_none_or(|ultima| agora - ultima >= INTERVALO_ENTRE_TROCAS)
}

/// A versão no endereço faz o navegador buscar a imagem nova, e a antiga pode ficar em cache para sempre.
pub fn endereco_da_imagem(url_publica: &str, conta_id: Uuid, tipo: TipoDeImagem, versao: DateTime<Utc>) -> String {
    format!(
        "{}/contas/{conta_id}/imagens/{}?v={}",
        url_publica.trim_end_matches('/'),
        tipo.texto(),
        versao.timestamp_millis()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const WEBP: &[u8] = b"RIFF\0\0\0\0WEBPVP8 ";

    #[test]
    fn reconhece_o_formato_pelos_bytes() {
        assert_eq!(FormatoDaImagem::dos_bytes(WEBP), Some(FormatoDaImagem::Webp));
        assert_eq!(FormatoDaImagem::dos_bytes(&[0xFF, 0xD8, 0xFF, 0xE0]), Some(FormatoDaImagem::Jpeg));
        assert_eq!(FormatoDaImagem::dos_bytes(b"\x89PNG\r\n\x1a\n...."), Some(FormatoDaImagem::Png));
        assert_eq!(FormatoDaImagem::dos_bytes(b"<svg onload=alert(1)>"), None);
    }

    #[test]
    fn recusa_imagem_vazia_grande_ou_de_outro_formato() {
        assert_eq!(validar_imagem(TipoDeImagem::Foto, vec![]), Err(ErroDaImagem::Vazia));
        let mut grande = WEBP.to_vec();
        grande.resize(TipoDeImagem::Foto.tamanho_maximo() + 1, 0);
        assert_eq!(validar_imagem(TipoDeImagem::Foto, grande.clone()), Err(ErroDaImagem::Grande));
        assert!(validar_imagem(TipoDeImagem::Capa, grande).is_ok());
        assert_eq!(validar_imagem(TipoDeImagem::Capa, b"GIF89a".to_vec()), Err(ErroDaImagem::FormatoDesconhecido));
    }

    #[test]
    fn so_troca_espacado() {
        let agora = Utc::now();
        assert!(pode_trocar(None, agora));
        assert!(!pode_trocar(Some(agora - Duration::seconds(3)), agora));
        assert!(pode_trocar(Some(agora - INTERVALO_ENTRE_TROCAS), agora));
    }

    #[test]
    fn o_endereco_tem_a_versao() {
        let versao = DateTime::from_timestamp_millis(1234).unwrap();
        assert_eq!(
            endereco_da_imagem("https://api.exemplo.com/", Uuid::nil(), TipoDeImagem::Capa, versao),
            "https://api.exemplo.com/contas/00000000-0000-0000-0000-000000000000/imagens/capa?v=1234"
        );
    }

    #[test]
    fn tipo_e_formato_vao_e_voltam_do_texto() {
        assert_eq!(TipoDeImagem::do_texto("foto"), Some(TipoDeImagem::Foto));
        assert_eq!(TipoDeImagem::do_texto("banner"), None);
        assert_eq!(FormatoDaImagem::do_texto("image/png"), Some(FormatoDaImagem::Png));
    }
}
