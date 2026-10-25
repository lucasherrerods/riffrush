use std::collections::HashMap;
use std::sync::Arc;

use super::dominio::{origem_do_id, DadosDaMusica, Origem, CONSULTAS_POR_PEDIDO};
use super::portas::{FonteDeMusicas, RepositorioDoCatalogo};

#[derive(Clone)]
pub struct ServicosDoCatalogo {
    pub repositorio: Arc<dyn RepositorioDoCatalogo>,
    pub encore: Arc<dyn FonteDeMusicas>,
}

impl ServicosDoCatalogo {
    /// Os dados de cada id que já sabemos ou conseguimos descobrir agora.
    /// O catálogo só enfeita o ranking: se o banco ou o Encore falharem, devolve o que tiver, sem erro.
    pub async fn dados(&self, ids: &[String]) -> HashMap<String, DadosDaMusica> {
        let mut conhecidos = match self.repositorio.buscar(ids).await {
            Ok(conhecidos) => conhecidos,
            Err(falha) => {
                tracing::warn!(%falha, "não deu para ler o catálogo de músicas");
                return HashMap::new();
            }
        };
        let faltando: Vec<&String> = ids.iter().filter(|id| !conhecidos.contains_key(*id)).collect();
        let mut consultas = 0;
        for id in faltando {
            let dados = match origem_do_id(id) {
                Origem::DoJogo => continue,
                Origem::Arquivo(dados) => dados,
                Origem::Encore(md5) => {
                    if consultas == CONSULTAS_POR_PEDIDO {
                        continue;
                    }
                    consultas += 1;
                    match self.encore.por_md5(&md5).await {
                        Ok(dados) => dados.unwrap_or_default(),
                        // Fora do ar: tenta de novo no próximo pedido, sem guardar.
                        Err(falha) => {
                            tracing::warn!(%falha, "o Encore não respondeu");
                            continue;
                        }
                    }
                }
            };
            if let Err(falha) = self.repositorio.guardar(id, &dados).await {
                tracing::warn!(%falha, "não deu para guardar a música no catálogo");
            }
            conhecidos.insert(id.clone(), dados);
        }
        conhecidos
    }
}

/// Fakes das portas, para os testes daqui e os de integração (feature `testes`).
#[cfg(any(test, feature = "testes"))]
pub mod fakes {
    use std::sync::Mutex;

    use async_trait::async_trait;

    use super::*;
    use crate::modules::conta::FalhaExterna;

    #[derive(Default)]
    pub struct CatalogoEmMemoria(pub Mutex<HashMap<String, DadosDaMusica>>);

    #[async_trait]
    impl RepositorioDoCatalogo for CatalogoEmMemoria {
        async fn buscar(&self, ids: &[String]) -> Result<HashMap<String, DadosDaMusica>, FalhaExterna> {
            let guardadas = self.0.lock().unwrap();
            Ok(ids.iter().filter_map(|id| guardadas.get(id).map(|d| (id.clone(), d.clone()))).collect())
        }
        async fn guardar(&self, musica_id: &str, dados: &DadosDaMusica) -> Result<(), FalhaExterna> {
            self.0.lock().unwrap().insert(musica_id.into(), dados.clone());
            Ok(())
        }
    }

    /// Conhece os md5 do mapa e conta as consultas. Sem `fora_do_ar`, responde.
    #[derive(Default)]
    pub struct EncoreFalso {
        pub charts: HashMap<String, DadosDaMusica>,
        pub consultas: Mutex<Vec<String>>,
        pub fora_do_ar: bool,
    }

    #[async_trait]
    impl FonteDeMusicas for EncoreFalso {
        async fn por_md5(&self, md5: &str) -> Result<Option<DadosDaMusica>, FalhaExterna> {
            self.consultas.lock().unwrap().push(md5.into());
            if self.fora_do_ar {
                return Err(FalhaExterna("encore fora do ar".into()));
            }
            Ok(self.charts.get(md5).cloned())
        }
    }

    pub fn servicos_do_catalogo(encore: EncoreFalso) -> (ServicosDoCatalogo, Arc<CatalogoEmMemoria>, Arc<EncoreFalso>) {
        let repositorio = Arc::new(CatalogoEmMemoria::default());
        let encore = Arc::new(encore);
        let servicos = ServicosDoCatalogo {
            repositorio: repositorio.clone(),
            encore: encore.clone(),
        };
        (servicos, repositorio, encore)
    }
}

#[cfg(test)]
mod tests {
    use super::fakes::{servicos_do_catalogo, EncoreFalso};
    use super::*;

    const MD5: &str = "fb0079d4c2e025d5b8dd70724750a923";

    fn goofy() -> DadosDaMusica {
        DadosDaMusica {
            titulo: Some("Goofy Goober Rock".into()),
            artista: Some("Tom Rothrock with Jim Wise".into()),
            capa: Some("https://files.enchor.us/capa.jpg".into()),
        }
    }

    fn encore_com_goofy() -> EncoreFalso {
        EncoreFalso {
            charts: HashMap::from([(MD5.into(), goofy())]),
            ..Default::default()
        }
    }

    #[tokio::test]
    async fn procura_no_encore_uma_vez_e_guarda() {
        let (servicos, repositorio, encore) = servicos_do_catalogo(encore_com_goofy());
        let ids = vec![format!("encore:{MD5}")];

        assert_eq!(servicos.dados(&ids).await[&ids[0]], goofy());
        assert_eq!(servicos.dados(&ids).await[&ids[0]], goofy());

        assert_eq!(encore.consultas.lock().unwrap().len(), 1);
        assert!(repositorio.0.lock().unwrap().contains_key(&ids[0]));
    }

    #[tokio::test]
    async fn arquivo_sai_do_nome_e_musica_do_jogo_fica_de_fora_sem_consultar() {
        let (servicos, _, encore) = servicos_do_catalogo(EncoreFalso::default());
        let ids = vec!["arquivo:Rush - Tom Sawyer.sng:1".to_string(), "spektrem-shine".to_string()];

        let dados = servicos.dados(&ids).await;

        assert_eq!(dados[&ids[0]].titulo.as_deref(), Some("Tom Sawyer"));
        assert!(!dados.contains_key(&ids[1]));
        assert!(encore.consultas.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn musica_que_o_encore_nao_conhece_fica_guardada_sem_titulo() {
        let (servicos, repositorio, encore) = servicos_do_catalogo(EncoreFalso::default());
        let ids = vec![format!("encore:{MD5}")];

        servicos.dados(&ids).await;
        servicos.dados(&ids).await;

        assert_eq!(repositorio.0.lock().unwrap()[&ids[0]], DadosDaMusica::default());
        assert_eq!(encore.consultas.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn encore_fora_do_ar_nao_guarda_nem_falha() {
        let (servicos, repositorio, _) = servicos_do_catalogo(EncoreFalso {
            fora_do_ar: true,
            ..Default::default()
        });
        let ids = vec![format!("encore:{MD5}")];

        assert!(servicos.dados(&ids).await.is_empty());
        assert!(repositorio.0.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn cada_pedido_consulta_no_maximo_algumas_musicas_novas() {
        let (servicos, _, encore) = servicos_do_catalogo(EncoreFalso::default());
        let ids: Vec<String> = (0..CONSULTAS_POR_PEDIDO + 5).map(|i| format!("encore:{i:032x}")).collect();

        servicos.dados(&ids).await;
        assert_eq!(encore.consultas.lock().unwrap().len(), CONSULTAS_POR_PEDIDO);
        servicos.dados(&ids).await;
        assert_eq!(encore.consultas.lock().unwrap().len(), CONSULTAS_POR_PEDIDO + 5);
    }
}
