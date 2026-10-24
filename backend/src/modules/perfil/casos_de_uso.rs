use std::sync::Arc;

use super::dominio::{montar_perfil, Perfil, PARTIDAS_RECENTES};
use super::portas::RepositorioDoPerfil;
use crate::modules::conta::{FalhaExterna, ServicosDaConta};

#[derive(Clone)]
pub struct ServicosDoPerfil {
    pub repositorio: Arc<dyn RepositorioDoPerfil>,
    /// Para achar a conta pela sessão.
    pub conta: ServicosDaConta,
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
        Ok(montar_perfil(conta, dados))
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
    use crate::modules::perfil::dominio::DadosDoPerfil;

    #[derive(Default)]
    pub struct PerfilEmMemoria {
        pub dados: Mutex<HashMap<Uuid, DadosDoPerfil>>,
        /// Quantas recentes o último pedido quis.
        pub ultimo_limite: Mutex<Option<u32>>,
    }

    pub fn servicos_do_perfil(conta: ServicosDaConta) -> (ServicosDoPerfil, Arc<PerfilEmMemoria>) {
        let repositorio = Arc::new(PerfilEmMemoria::default());
        let servicos = ServicosDoPerfil {
            repositorio: repositorio.clone(),
            conta,
        };
        (servicos, repositorio)
    }

    #[async_trait]
    impl RepositorioDoPerfil for PerfilEmMemoria {
        async fn dados(&self, conta_id: Uuid, recentes: u32) -> Result<Option<DadosDoPerfil>, FalhaExterna> {
            *self.ultimo_limite.lock().unwrap() = Some(recentes);
            Ok(self.dados.lock().unwrap().get(&conta_id).cloned())
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
    async fn sem_sessao_valida_e_recusado() {
        let (servicos, _) = servicos_do_perfil(servicos().0);
        assert!(matches!(servicos.perfil("inventado").await, Err(ErroDoPerfil::SessaoInvalida)));
    }
}
