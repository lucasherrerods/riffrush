use std::sync::Arc;

use uuid::Uuid;

use super::dominio::{montar_perfil, Perfil, Recorde, PARTIDAS_RECENTES};
use super::imagem::{endereco_da_imagem, pode_trocar, validar_imagem, ErroDaImagem, Imagem, TipoDeImagem};
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
    /// O endereço da própria API visto de fora, para montar o das imagens.
    pub url_publica: String,
}

#[derive(Debug, thiserror::Error)]
pub enum ErroDoPerfil {
    #[error("sessão inválida ou expirada")]
    SessaoInvalida,
    #[error(transparent)]
    ImagemInvalida(#[from] ErroDaImagem),
    #[error("espere um pouco antes de trocar de novo")]
    TrocaFrequente,
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

    /// Troca a foto ou a capa de quem está logado e devolve o endereço da nova.
    pub async fn trocar_imagem(&self, token: &str, tipo: TipoDeImagem, conteudo: Vec<u8>) -> Result<String, ErroDoPerfil> {
        let conta = self.conta.conta_da_sessao(token).await.map_err(|_| ErroDoPerfil::SessaoInvalida)?;
        let imagem = validar_imagem(tipo, conteudo)?;
        let agora = self.conta.relogio.agora();
        if !pode_trocar(self.repositorio.ultima_troca(conta.id).await?, agora) {
            return Err(ErroDoPerfil::TrocaFrequente);
        }
        let endereco = endereco_da_imagem(&self.url_publica, conta.id, tipo, agora);
        self.repositorio.guardar_imagem(conta.id, tipo, &imagem, &endereco, agora).await?;
        Ok(endereco)
    }

    pub async fn remover_imagem(&self, token: &str, tipo: TipoDeImagem) -> Result<(), ErroDoPerfil> {
        let conta = self.conta.conta_da_sessao(token).await.map_err(|_| ErroDoPerfil::SessaoInvalida)?;
        Ok(self.repositorio.apagar_imagem(conta.id, tipo).await?)
    }

    /// Pública: a foto aparece para todo mundo no ranking, nos amigos e nas salas.
    pub async fn imagem(&self, conta_id: Uuid, tipo: TipoDeImagem) -> Result<Option<Imagem>, ErroDoPerfil> {
        Ok(self.repositorio.imagem(conta_id, tipo).await?)
    }
}

/// Fake do repositório, para os testes daqui e os de integração (feature `testes`).
#[cfg(any(test, feature = "testes"))]
pub mod fakes {
    use std::collections::HashMap;
    use std::sync::Mutex;

    use async_trait::async_trait;
    use chrono::{DateTime, Utc};
    use uuid::Uuid;

    use super::*;
    use crate::modules::perfil::dominio::{DadosDoPerfil, Recorde};

    pub type ImagemGuardada = (Imagem, String, DateTime<Utc>);

    #[derive(Default)]
    pub struct PerfilEmMemoria {
        pub dados: Mutex<HashMap<Uuid, DadosDoPerfil>>,
        pub recordes: Mutex<HashMap<Uuid, Vec<Recorde>>>,
        /// Pela conta e pelo tipo: a imagem, o endereço e quando foi trocada.
        pub imagens: Mutex<HashMap<(Uuid, &'static str), ImagemGuardada>>,
        /// Quantas recentes o último pedido quis.
        pub ultimo_limite: Mutex<Option<u32>>,
    }

    pub fn servicos_do_perfil(conta: ServicosDaConta) -> (ServicosDoPerfil, Arc<PerfilEmMemoria>) {
        let repositorio = Arc::new(PerfilEmMemoria::default());
        let servicos = ServicosDoPerfil {
            repositorio: repositorio.clone(),
            conta,
            catalogo: crate::modules::catalogo::fakes::servicos_do_catalogo(Default::default()).0,
            url_publica: "https://api.exemplo.com".into(),
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

        async fn guardar_imagem(&self, conta_id: Uuid, tipo: TipoDeImagem, imagem: &Imagem, endereco: &str, agora: DateTime<Utc>) -> Result<(), FalhaExterna> {
            self.imagens
                .lock()
                .unwrap()
                .insert((conta_id, tipo.texto()), (imagem.clone(), endereco.into(), agora));
            Ok(())
        }

        async fn apagar_imagem(&self, conta_id: Uuid, tipo: TipoDeImagem) -> Result<(), FalhaExterna> {
            self.imagens.lock().unwrap().remove(&(conta_id, tipo.texto()));
            Ok(())
        }

        async fn imagem(&self, conta_id: Uuid, tipo: TipoDeImagem) -> Result<Option<Imagem>, FalhaExterna> {
            Ok(self.imagens.lock().unwrap().get(&(conta_id, tipo.texto())).map(|(imagem, _, _)| imagem.clone()))
        }

        async fn ultima_troca(&self, conta_id: Uuid) -> Result<Option<DateTime<Utc>>, FalhaExterna> {
            Ok(self
                .imagens
                .lock()
                .unwrap()
                .iter()
                .filter(|((id, _), _)| *id == conta_id)
                .map(|(_, (_, _, quando))| *quando)
                .max())
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
            capa: None,
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

    const WEBP: &[u8] = b"RIFF\0\0\0\0WEBPVP8 ";

    #[tokio::test]
    async fn troca_a_foto_e_devolve_o_endereco_publico() {
        let conta = servicos().0;
        let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let (servicos, repositorio) = servicos_do_perfil(conta);

        let endereco = servicos.trocar_imagem(&entrada.token, TipoDeImagem::Foto, WEBP.to_vec()).await.unwrap();

        assert!(endereco.starts_with(&format!("https://api.exemplo.com/contas/{}/imagens/foto?v=", entrada.conta.id)));
        let guardada = servicos.imagem(entrada.conta.id, TipoDeImagem::Foto).await.unwrap().unwrap();
        assert_eq!(guardada.conteudo, WEBP);
        assert_eq!(repositorio.imagens.lock().unwrap()[&(entrada.conta.id, "foto")].1, endereco);
    }

    #[tokio::test]
    async fn recusa_imagem_invalida_e_troca_seguida() {
        let conta = servicos().0;
        let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let (servicos, _) = servicos_do_perfil(conta);

        assert!(matches!(
            servicos.trocar_imagem(&entrada.token, TipoDeImagem::Capa, b"<svg/>".to_vec()).await,
            Err(ErroDoPerfil::ImagemInvalida(ErroDaImagem::FormatoDesconhecido))
        ));
        servicos.trocar_imagem(&entrada.token, TipoDeImagem::Capa, WEBP.to_vec()).await.unwrap();
        assert!(matches!(
            servicos.trocar_imagem(&entrada.token, TipoDeImagem::Foto, WEBP.to_vec()).await,
            Err(ErroDoPerfil::TrocaFrequente)
        ));
    }

    #[tokio::test]
    async fn remove_a_imagem_e_exige_sessao() {
        let conta = servicos().0;
        let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let (servicos, _) = servicos_do_perfil(conta);
        servicos.trocar_imagem(&entrada.token, TipoDeImagem::Capa, WEBP.to_vec()).await.unwrap();

        assert!(matches!(
            servicos.remover_imagem("inventado", TipoDeImagem::Capa).await,
            Err(ErroDoPerfil::SessaoInvalida)
        ));
        servicos.remover_imagem(&entrada.token, TipoDeImagem::Capa).await.unwrap();

        assert_eq!(servicos.imagem(entrada.conta.id, TipoDeImagem::Capa).await.unwrap(), None);
    }
}
