use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Quantas playlists uma conta pode ter, somando os dois modos.
pub const MAXIMO_DE_PLAYLISTS: usize = 10;
/// Quantas músicas cabem numa playlist.
pub const MAXIMO_DE_FAIXAS: usize = 50;
pub const MAXIMO_DO_NOME: usize = 40;
const MAXIMO_DA_MUSICA: usize = 100;
const MAXIMO_DA_VERSAO: usize = 64;
const MAXIMO_DO_TITULO: usize = 120;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModoDaPlaylist {
    Rock,
    Mania,
}

impl ModoDaPlaylist {
    pub fn do_texto(texto: &str) -> Option<Self> {
        match texto {
            "rock" => Some(Self::Rock),
            "mania" => Some(Self::Mania),
            _ => None,
        }
    }

    pub fn como_texto(self) -> &'static str {
        match self {
            Self::Rock => "rock",
            Self::Mania => "mania",
        }
    }
}

/// Uma música numa versão: a dificuldade no Rock, o hash do beatmap no Mania.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Faixa {
    pub musica: String,
    pub versao: String,
    pub titulo: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Playlist {
    /// Gerado pelo jogo, para a playlist criada sem internet manter o id quando subir.
    pub id: Uuid,
    pub nome: String,
    pub modo: ModoDaPlaylist,
    /// Aparece no perfil para os amigos.
    pub publica: bool,
    pub faixas: Vec<Faixa>,
    pub atualizada_em: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum PlaylistInvalida {
    #[error("o nome precisa ter de 1 a {MAXIMO_DO_NOME} letras")]
    Nome,
    #[error("a playlist cabe até {MAXIMO_DE_FAIXAS} músicas")]
    FaixasDemais,
    #[error("música com id, versão ou título vazio ou grande demais")]
    Faixa,
    #[error("a mesma música na mesma versão aparece duas vezes")]
    FaixaRepetida,
    #[error("a conta pode ter até {MAXIMO_DE_PLAYLISTS} playlists")]
    PlaylistsDemais,
}

fn tamanho_ok(texto: &str, maximo: usize) -> bool {
    !texto.is_empty() && texto.chars().count() <= maximo
}

/// Confere os limites e devolve a playlist com o nome e os títulos sem espaços nas pontas.
pub fn validar_playlist(mut playlist: Playlist) -> Result<Playlist, PlaylistInvalida> {
    playlist.nome = playlist.nome.trim().to_string();
    if !tamanho_ok(&playlist.nome, MAXIMO_DO_NOME) {
        return Err(PlaylistInvalida::Nome);
    }
    if playlist.faixas.len() > MAXIMO_DE_FAIXAS {
        return Err(PlaylistInvalida::FaixasDemais);
    }
    for faixa in &mut playlist.faixas {
        faixa.titulo = faixa.titulo.trim().to_string();
        if !tamanho_ok(&faixa.musica, MAXIMO_DA_MUSICA) || !tamanho_ok(&faixa.versao, MAXIMO_DA_VERSAO) || !tamanho_ok(&faixa.titulo, MAXIMO_DO_TITULO) {
            return Err(PlaylistInvalida::Faixa);
        }
    }
    for (i, faixa) in playlist.faixas.iter().enumerate() {
        if playlist.faixas[..i].iter().any(|f| f.musica == faixa.musica && f.versao == faixa.versao) {
            return Err(PlaylistInvalida::FaixaRepetida);
        }
    }
    Ok(playlist)
}

/// Uma playlist nova só entra se a conta ainda não chegou no limite; editar uma que já existe sempre pode.
pub fn cabe_mais_uma(existentes: &[Uuid], id: Uuid) -> Result<(), PlaylistInvalida> {
    if existentes.contains(&id) || existentes.len() < MAXIMO_DE_PLAYLISTS {
        Ok(())
    } else {
        Err(PlaylistInvalida::PlaylistsDemais)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn faixa(musica: &str) -> Faixa {
        Faixa {
            musica: musica.into(),
            versao: "expert".into(),
            titulo: "Shine".into(),
        }
    }

    fn playlist(nome: &str, faixas: Vec<Faixa>) -> Playlist {
        Playlist {
            id: Uuid::nil(),
            nome: nome.into(),
            modo: ModoDaPlaylist::Rock,
            publica: true,
            faixas,
            atualizada_em: DateTime::UNIX_EPOCH,
        }
    }

    #[test]
    fn limpa_o_nome_e_aceita_dentro_dos_limites() {
        let ok = validar_playlist(playlist("  Treino  ", vec![faixa("a"), faixa("b")])).unwrap();
        assert_eq!(ok.nome, "Treino");
    }

    #[test]
    fn recusa_nome_vazio_ou_grande() {
        assert_eq!(validar_playlist(playlist("   ", vec![])), Err(PlaylistInvalida::Nome));
        assert_eq!(validar_playlist(playlist(&"a".repeat(MAXIMO_DO_NOME + 1), vec![])), Err(PlaylistInvalida::Nome));
        assert!(validar_playlist(playlist(&"é".repeat(MAXIMO_DO_NOME), vec![])).is_ok());
    }

    #[test]
    fn recusa_mais_de_cinquenta_faixas() {
        let faixas = (0..=MAXIMO_DE_FAIXAS).map(|i| faixa(&i.to_string())).collect();
        assert_eq!(validar_playlist(playlist("A", faixas)), Err(PlaylistInvalida::FaixasDemais));
        let faixas = (0..MAXIMO_DE_FAIXAS).map(|i| faixa(&i.to_string())).collect();
        assert!(validar_playlist(playlist("A", faixas)).is_ok());
    }

    #[test]
    fn recusa_faixa_vazia_grande_ou_repetida() {
        assert_eq!(validar_playlist(playlist("A", vec![faixa("")])), Err(PlaylistInvalida::Faixa));
        assert_eq!(validar_playlist(playlist("A", vec![faixa(&"x".repeat(101))])), Err(PlaylistInvalida::Faixa));
        assert_eq!(
            validar_playlist(playlist("A", vec![faixa("a"), faixa("a")])),
            Err(PlaylistInvalida::FaixaRepetida)
        );
        let mut outra_versao = faixa("a");
        outra_versao.versao = "facil".into();
        assert!(validar_playlist(playlist("A", vec![faixa("a"), outra_versao])).is_ok());
    }

    #[test]
    fn a_decima_primeira_nao_entra_mas_editar_sempre_pode() {
        let ids: Vec<Uuid> = (0..MAXIMO_DE_PLAYLISTS as u128).map(Uuid::from_u128).collect();
        assert_eq!(cabe_mais_uma(&ids, Uuid::from_u128(99)), Err(PlaylistInvalida::PlaylistsDemais));
        assert_eq!(cabe_mais_uma(&ids, Uuid::from_u128(3)), Ok(()));
        assert_eq!(cabe_mais_uma(&ids[..9], Uuid::from_u128(99)), Ok(()));
    }
}
