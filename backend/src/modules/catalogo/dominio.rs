/// Quantas músicas novas um pedido procura no Encore. As outras ficam para o próximo pedido,
/// para a primeira abertura do ranking não esperar dezenas de consultas.
pub const CONSULTAS_POR_PEDIDO: usize = 10;

/// O que sabemos de uma música. Tudo opcional: uma música não achada fica guardada sem título.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DadosDaMusica {
    pub titulo: Option<String>,
    pub artista: Option<String>,
    /// Endereço da imagem da capa.
    pub capa: Option<String>,
}

/// De onde tirar os dados de uma música, pelo formato do id.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Origem {
    /// Baixada do Encore: `encore:<md5 do chart>`.
    Encore(String),
    /// Importada de um arquivo, antes de o ranking usar o md5: `arquivo:Artista - Título.sng:<tamanho>`.
    /// O nome do arquivo já diz tudo.
    Arquivo(DadosDaMusica),
    /// Vem com o jogo: o app já tem os dados.
    DoJogo,
}

fn eh_md5(texto: &str) -> bool {
    texto.len() == 32 && texto.bytes().all(|b| b.is_ascii_hexdigit())
}

/// "Artista - Título.sng" vira artista e título. Sem o separador, o nome todo é o título.
fn dados_do_arquivo(nome: &str) -> DadosDaMusica {
    let sem_extensao = nome.rsplit_once('.').map_or(nome, |(base, _)| base).trim();
    let (artista, titulo) = match sem_extensao.split_once(" - ") {
        Some((artista, titulo)) => (Some(artista.trim().to_string()), titulo.trim()),
        None => (None, sem_extensao),
    };
    DadosDaMusica {
        titulo: (!titulo.is_empty()).then(|| titulo.to_string()),
        artista: artista.filter(|a| !a.is_empty()),
        capa: None,
    }
}

pub fn origem_do_id(musica_id: &str) -> Origem {
    if let Some(md5) = musica_id.strip_prefix("encore:").filter(|md5| eh_md5(md5)) {
        return Origem::Encore(md5.to_ascii_lowercase());
    }
    if let Some(resto) = musica_id.strip_prefix("arquivo:") {
        // O tamanho do arquivo vem no fim, depois do último ':'.
        let nome = resto.rsplit_once(':').map_or(resto, |(nome, _)| nome);
        return Origem::Arquivo(dados_do_arquivo(nome));
    }
    Origem::DoJogo
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn id_do_encore_vira_o_md5() {
        assert_eq!(
            origem_do_id("encore:FB0079D4C2E025D5B8DD70724750A923"),
            Origem::Encore("fb0079d4c2e025d5b8dd70724750a923".into())
        );
        // Um md5 quebrado não vai para o Encore.
        assert_eq!(origem_do_id("encore:abc"), Origem::DoJogo);
    }

    #[test]
    fn arquivo_vira_artista_e_titulo_pelo_nome() {
        assert_eq!(
            origem_do_id("arquivo:Joan Jett And The Blackhearts - I Love Rock N' Roll.sng:12111137"),
            Origem::Arquivo(DadosDaMusica {
                titulo: Some("I Love Rock N' Roll".into()),
                artista: Some("Joan Jett And The Blackhearts".into()),
                capa: None,
            })
        );
        // Só o primeiro " - " separa: o resto é do título.
        let Origem::Arquivo(dados) = origem_do_id("arquivo:Rush - 2112 - Overture.sng:1") else {
            panic!("esperava arquivo")
        };
        assert_eq!((dados.artista.as_deref(), dados.titulo.as_deref()), (Some("Rush"), Some("2112 - Overture")));
    }

    #[test]
    fn arquivo_sem_separador_fica_so_com_o_titulo() {
        let Origem::Arquivo(dados) = origem_do_id("arquivo:musica.chart:10") else {
            panic!("esperava arquivo")
        };
        assert_eq!((dados.artista, dados.titulo.as_deref()), (None, Some("musica")));
    }

    #[test]
    fn o_resto_vem_com_o_jogo() {
        assert_eq!(origem_do_id("spektrem-shine"), Origem::DoJogo);
    }
}
