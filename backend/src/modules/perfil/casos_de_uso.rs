use std::sync::Arc;

use super::dominio::{montar_perfil, Perfil, Recorde, PARTIDAS_RECENTES};
use super::portas::RepositorioDoPerfil;
use crate::modules::catalogo::ServicosDoCatalogo;
use crate::modules::conta::{FalhaExterna, ServicosDaConta};

#[derive(Clone)]
pub struct ServicosDoPerfil {
    pub repositorio: Arc<dyn RepositorioDoPerfil>,
    /// Para achar a conta pela sessão.
    pub conta: ServicosDaConta,
    /// Nome, banda e capa das músicas que aparecem no perfil.
    pub catalogo: ServicosDoCatalogo,
}

#[derive(Debug, thiserror::Error)]
pub enum ErroDoPerfil {
    #[error("sessão inválida ou expirada")]
    SessaoInvalida,
    #[error(transparent)]
    Falha(#[from] FalhaExterna),
}

impl ServicosDoPerfil {
    pub async fn perfil(&self, token: &str) -> Result<Perfil, ErroDoPerfil> {
        let conta = self.conta.conta_da_sessao(token).await.map_err(|_| ErroDoPerfil::SessaoInvalida)?;
        // A conta pode ter sido excluída entre a sessão e a consulta.
        let dados = self.repositorio.dados(conta.id, PARTIDAS_RECENTES).await?.ok_or(ErroDoPerfil::SessaoInvalida)?;
        let mut perfil = montar_perfil(conta, dados);
        perfil.musicas = self.catalogo.dados(&perfil.ids_das_musicas()).await;
        Ok(perfil)
    }

    /// Os recordes de quem está logado, para a seleção de músicas mostrar em qualquer aparelho.
    pub async fn recordes(&self, token: &str) -> Result<Vec<Recorde>, ErroDoPerfil> {
        let conta = self.conta.conta_da_sessao(token).await.map_err(|_| ErroDoPerfil::SessaoInvalida)?;
        Ok(self.repositorio.recordes(conta.id).await?)
    }
}

/// Fake do repositório, para os testes daqui e os de integração (feature `testes`).
#[cfg(any(test, feature = "testes"))]
pub mod fakes {
    use std::collections::HashMap;
    use std::sync::Mutex;

    use async_trait::async_trait;
    use uuid::Uuid;

    use super::*;
    use crate::modules::perfil::dominio::{DadosDoPerfil, Recorde};

    #[derive(Default)]
    pub struct PerfilEmMemoria {
        pub dados: Mutex<HashMap<Uuid, DadosDoPerfil>>,
        pub recordes: Mutex<HashMap<Uuid, Vec<Recorde>>>,
        /// Quantas recentes o último pedido quis.
        pub ultimo_limite: Mutex<Option<u32>>,
    }

    pub fn servicos_do_perfil(conta: ServicosDaConta) -> (ServicosDoPerfil, Arc<PerfilEmMemoria>) {
        let repositorio = Arc::new(PerfilEmMemoria::default());
        let servicos = ServicosDoPerfil {
            repositorio: repositorio.clone(),
            conta,
            catalogo: crate::modules::catalogo::fakes::servicos_do_catalogo(Default::default()).0,
        };
        (servicos, repositorio)
    }

    #[async_trait]
    impl RepositorioDoPerfil for PerfilEmMemoria {
        async fn dados(&self, conta_id: Uuid, recentes: u32) -> Result<Option<DadosDoPerfil>, FalhaExterna> {
            *self.ultimo_limite.lock().unwrap() = Some(recentes);
            Ok(self.dados.lock().unwrap().get(&conta_id).cloned())
        }

        async fn recordes(&self, conta_id: Uuid) -> Result<Vec<Recorde>, FalhaExterna> {
            Ok(self.recordes.lock().unwrap().get(&conta_id).cloned().unwrap_or_default())
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::DateTime;

    use super::fakes::servicos_do_perfil;
    use super::*;
    use crate::modules::conta::fakes::{pedido, servicos};
    use crate::modules::perfil::dominio::DadosDoPerfil;

    fn dados() -> DadosDoPerfil {
        DadosDoPerfil {
            criada_em: DateTime::UNIX_EPOCH,
            musicas_distintas: 2,
            por_dificuldade: vec![],
            por_instrumento: vec![],
            mais_tocadas: vec![],
            recentes: vec![],
        }
    }

    #[tokio::test]
    async fn devolve_o_perfil_de_quem_esta_logado() {
        let conta = servicos().0;
        let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let (servicos, repositorio) = servicos_do_perfil(conta);
        repositorio.dados.lock().unwrap().insert(entrada.conta.id, dados());

        let perfil = servicos.perfil(&entrada.token).await.unwrap();

        assert_eq!(perfil.conta.id, entrada.conta.id);
        assert_eq!(perfil.musicas_distintas, 2);
        assert_eq!(*repositorio.ultimo_limite.lock().unwrap(), Some(PARTIDAS_RECENTES));
    }

    #[tokio::test]
    async fn completa_as_musicas_do_perfil_com_o_catalogo() {
        let conta = servicos().0;
        let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let (servicos, repositorio) = servicos_do_perfil(conta);
        let mut com_musica = dados();
        com_musica.mais_tocadas = vec![crate::modules::perfil::dominio::MusicaMaisTocada {
            musica_id: "arquivo:Rush - Tom Sawyer.sng:1".into(),
            partidas: 3,
        }];
        repositorio.dados.lock().unwrap().insert(entrada.conta.id, com_musica);

        let perfil = servicos.perfil(&entrada.token).await.unwrap();

        assert_eq!(perfil.musicas["arquivo:Rush - Tom Sawyer.sng:1"].titulo.as_deref(), Some("Tom Sawyer"));
    }

    #[tokio::test]
    async fn sem_sessao_valida_e_recusado() {
        let (servicos, _) = servicos_do_perfil(servicos().0);
        assert!(matches!(servicos.perfil("inventado").await, Err(ErroDoPerfil::SessaoInvalida)));
        assert!(matches!(servicos.recordes("inventado").await, Err(ErroDoPerfil::SessaoInvalida)));
    }

    #[tokio::test]
    async fn devolve_os_recordes_de_quem_esta_logado() {
        let conta = servicos().0;
        let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let (servicos, repositorio) = servicos_do_perfil(conta);
        let recorde = Recorde {
            musica_id: "encore:abc".into(),
            dificuldade: crate::modules::progresso::Dificuldade::Expert,
            instrumento: crate::modules::progresso::Instrumento::Guitarra,
            pontos: 900,
            acertos: 10,
            total: 10,
            precisao: Some(0.97),
        };
        repositorio.recordes.lock().unwrap().insert(entrada.conta.id, vec![recorde.clone()]);

        assert_eq!(servicos.recordes(&entrada.token).await.unwrap(), vec![recorde]);
    }
}
