use std::sync::Arc;

use uuid::Uuid;

use super::dominio::{cabe_mais_uma, validar_playlist, Playlist, PlaylistInvalida};
use super::portas::RepositorioDePlaylists;
use crate::modules::amizade::{Relacao, RepositorioDeAmizades};
use crate::modules::conta::{FalhaExterna, ServicosDaConta};

#[derive(Clone)]
pub struct ServicosDePlaylists {
    pub repositorio: Arc<dyn RepositorioDePlaylists>,
    pub conta: ServicosDaConta,
    /// Só amigos veem as playlists um do outro, como o perfil.
    pub amizades: Arc<dyn RepositorioDeAmizades>,
}

#[derive(Debug, thiserror::Error)]
pub enum ErroDasPlaylists {
    #[error("sessão inválida ou expirada")]
    SessaoInvalida,
    #[error(transparent)]
    Invalida(#[from] PlaylistInvalida),
    #[error("essa playlist é de outra conta")]
    DeOutraConta,
    #[error("só dá para ver as playlists de amigos")]
    NaoEAmigo,
    #[error(transparent)]
    Falha(#[from] FalhaExterna),
}

impl ServicosDePlaylists {
    async fn conta(&self, token: &str) -> Result<Uuid, ErroDasPlaylists> {
        Ok(self.conta.conta_da_sessao(token).await.map_err(|_| ErroDasPlaylists::SessaoInvalida)?.id)
    }

    pub async fn minhas(&self, token: &str) -> Result<Vec<Playlist>, ErroDasPlaylists> {
        let conta = self.conta(token).await?;
        Ok(self.repositorio.da_conta(conta).await?)
    }

    /// Cria ou troca a playlist inteira; a data de edição é a do servidor.
    pub async fn guardar(&self, token: &str, playlist: Playlist) -> Result<Playlist, ErroDasPlaylists> {
        let conta = self.conta(token).await?;
        let mut playlist = validar_playlist(playlist)?;
        let existentes: Vec<Uuid> = self.repositorio.da_conta(conta).await?.iter().map(|p| p.id).collect();
        cabe_mais_uma(&existentes, playlist.id)?;
        playlist.atualizada_em = self.conta.relogio.agora();
        if !self.repositorio.guardar(conta, &playlist).await? {
            return Err(ErroDasPlaylists::DeOutraConta);
        }
        Ok(playlist)
    }

    pub async fn apagar(&self, token: &str, id: Uuid) -> Result<(), ErroDasPlaylists> {
        let conta = self.conta(token).await?;
        Ok(self.repositorio.apagar(conta, id).await?)
    }

    /// As playlists que o amigo deixou visíveis.
    pub async fn do_amigo(&self, token: &str, amigo: Uuid) -> Result<Vec<Playlist>, ErroDasPlaylists> {
        let conta = self.conta(token).await?;
        if self.amizades.relacao(conta, amigo).await? != Relacao::Amigos {
            return Err(ErroDasPlaylists::NaoEAmigo);
        }
        Ok(self.repositorio.da_conta(amigo).await?.into_iter().filter(|p| p.publica).collect())
    }
}

/// Fake do repositório, para os testes daqui e os de integração (feature `testes`).
#[cfg(any(test, feature = "testes"))]
pub mod fakes {
    use std::collections::HashMap;
    use std::sync::Mutex;

    use async_trait::async_trait;

    use super::*;

    /// Pelo id: a conta dona e a playlist.
    #[derive(Default)]
    pub struct PlaylistsEmMemoria(pub Mutex<HashMap<Uuid, (Uuid, Playlist)>>);

    #[async_trait]
    impl RepositorioDePlaylists for PlaylistsEmMemoria {
        async fn da_conta(&self, conta_id: Uuid) -> Result<Vec<Playlist>, FalhaExterna> {
            let mut lista: Vec<Playlist> = self
                .0
                .lock()
                .unwrap()
                .values()
                .filter(|(dona, _)| *dona == conta_id)
                .map(|(_, p)| p.clone())
                .collect();
            lista.sort_by_key(|p| std::cmp::Reverse(p.atualizada_em));
            Ok(lista)
        }

        async fn guardar(&self, conta_id: Uuid, playlist: &Playlist) -> Result<bool, FalhaExterna> {
            let mut todas = self.0.lock().unwrap();
            if todas.get(&playlist.id).is_some_and(|(dona, _)| *dona != conta_id) {
                return Ok(false);
            }
            todas.insert(playlist.id, (conta_id, playlist.clone()));
            Ok(true)
        }

        async fn apagar(&self, conta_id: Uuid, id: Uuid) -> Result<(), FalhaExterna> {
            let mut todas = self.0.lock().unwrap();
            if todas.get(&id).is_some_and(|(dona, _)| *dona == conta_id) {
                todas.remove(&id);
            }
            Ok(())
        }
    }

    pub fn servicos_de_playlists(conta: ServicosDaConta, amizades: Arc<dyn RepositorioDeAmizades>) -> (ServicosDePlaylists, Arc<PlaylistsEmMemoria>) {
        let repositorio = Arc::new(PlaylistsEmMemoria::default());
        (
            ServicosDePlaylists {
                repositorio: repositorio.clone(),
                conta,
                amizades,
            },
            repositorio,
        )
    }

    /// Para os testes de outros módulos, que só precisam montar o app.
    pub fn servicos_vazios(conta: ServicosDaConta) -> ServicosDePlaylists {
        let amizades = crate::modules::amizade::fakes::servicos_de_amizade(conta.clone(), Default::default()).1;
        servicos_de_playlists(conta, amizades).0
    }
}

#[cfg(test)]
mod tests {
    use chrono::DateTime;

    use super::fakes::servicos_de_playlists;
    use super::*;
    use crate::modules::conta::fakes::{pedido, servicos};
    use crate::modules::playlists::dominio::{Faixa, ModoDaPlaylist, MAXIMO_DE_PLAYLISTS};

    fn playlist(id: u128, publica: bool) -> Playlist {
        Playlist {
            id: Uuid::from_u128(id),
            nome: " Treino ".into(),
            modo: ModoDaPlaylist::Rock,
            publica,
            faixas: vec![Faixa {
                musica: "encore:abc".into(),
                versao: "expert".into(),
                titulo: "Shine".into(),
            }],
            atualizada_em: DateTime::UNIX_EPOCH,
        }
    }

    #[tokio::test]
    async fn guarda_limpa_e_devolve_as_minhas() {
        let conta = servicos().0;
        let eu = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let (servicos, _) = servicos_de_playlists(conta.clone(), crate::modules::amizade::fakes::servicos_de_amizade(conta, Default::default()).1);
        let guardada = servicos.guardar(&eu.token, playlist(1, true)).await.unwrap();
        assert_eq!(guardada.nome, "Treino");
        assert_ne!(guardada.atualizada_em, DateTime::UNIX_EPOCH);
        assert_eq!(servicos.minhas(&eu.token).await.unwrap(), vec![guardada]);
        servicos.apagar(&eu.token, Uuid::from_u128(1)).await.unwrap();
        assert!(servicos.minhas(&eu.token).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn sem_sessao_nao_entra() {
        let conta = servicos().0;
        let (servicos, _) = servicos_de_playlists(conta.clone(), crate::modules::amizade::fakes::servicos_de_amizade(conta, Default::default()).1);
        assert!(matches!(servicos.minhas("ruim").await, Err(ErroDasPlaylists::SessaoInvalida)));
    }

    #[tokio::test]
    async fn a_decima_primeira_e_recusada() {
        let conta = servicos().0;
        let eu = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let (servicos, _) = servicos_de_playlists(conta.clone(), crate::modules::amizade::fakes::servicos_de_amizade(conta, Default::default()).1);
        for id in 0..MAXIMO_DE_PLAYLISTS as u128 {
            servicos.guardar(&eu.token, playlist(id, true)).await.unwrap();
        }
        assert!(matches!(
            servicos.guardar(&eu.token, playlist(99, true)).await,
            Err(ErroDasPlaylists::Invalida(PlaylistInvalida::PlaylistsDemais))
        ));
        assert!(servicos.guardar(&eu.token, playlist(0, false)).await.is_ok());
    }

    #[tokio::test]
    async fn nao_escreve_por_cima_da_playlist_de_outra_conta() {
        let conta = servicos().0;
        let eu = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let (servicos, repositorio) = servicos_de_playlists(conta.clone(), crate::modules::amizade::fakes::servicos_de_amizade(conta, Default::default()).1);
        repositorio
            .0
            .lock()
            .unwrap()
            .insert(Uuid::from_u128(1), (Uuid::from_u128(777), playlist(1, true)));
        assert!(matches!(
            servicos.guardar(&eu.token, playlist(1, true)).await,
            Err(ErroDasPlaylists::DeOutraConta)
        ));
    }

    #[tokio::test]
    async fn so_amigos_veem_e_so_as_publicas() {
        let conta = servicos().0;
        let eu = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let amigo = Uuid::from_u128(42);
        let amizades = crate::modules::amizade::fakes::servicos_de_amizade(conta.clone(), Default::default()).1;
        let (servicos, repositorio) = servicos_de_playlists(conta, amizades.clone());
        repositorio.0.lock().unwrap().insert(Uuid::from_u128(1), (amigo, playlist(1, true)));
        repositorio.0.lock().unwrap().insert(Uuid::from_u128(2), (amigo, playlist(2, false)));

        assert!(matches!(servicos.do_amigo(&eu.token, amigo).await, Err(ErroDasPlaylists::NaoEAmigo)));
        amizades.amizades.lock().unwrap().push((eu.conta.id, amigo, true, DateTime::UNIX_EPOCH));
        let vistas = servicos.do_amigo(&eu.token, amigo).await.unwrap();
        assert_eq!(vistas.iter().map(|p| p.id).collect::<Vec<_>>(), [Uuid::from_u128(1)]);
    }
}
