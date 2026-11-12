use std::sync::Arc;

use chrono::{DateTime, Utc};

use super::dominio::{limite_do_pedido, Atividade, Evento};
use super::portas::RepositorioDeAtividades;
use crate::modules::conta::FalhaExterna;
use crate::modules::mania::metadados_do_osu;

#[derive(Clone)]
pub struct ServicosDeAtividades {
    pub repositorio: Arc<dyn RepositorioDeAtividades>,
}

impl ServicosDeAtividades {
    /// O log mais recente; com `antes`, a página seguinte.
    pub async fn recentes(&self, antes: Option<DateTime<Utc>>, limite: Option<u32>) -> Result<Vec<Atividade>, FalhaExterna> {
        let brutas = self.repositorio.recentes(antes, limite_do_pedido(limite)).await?;
        Ok(brutas
            .into_iter()
            .map(|(atividade, texto)| com_nome_do_mapa(atividade, texto.as_deref()))
            .collect())
    }
}

/// Partida do Mania sem nome ganha o que estiver no .osu guardado.
fn com_nome_do_mapa(mut atividade: Atividade, texto: Option<&str>) -> Atividade {
    if let Evento::PartidaDoMania {
        titulo, artista, dificuldade, ..
    } = &mut atividade.evento
    {
        if titulo.is_none() {
            if let Some((t, a, d)) = texto.and_then(metadados_do_osu) {
                *titulo = Some(t);
                *artista = Some(a);
                *dificuldade = Some(d);
            }
        }
    }
    atividade
}

#[cfg(any(test, feature = "testes"))]
pub mod fakes {
    use std::sync::Mutex;

    use async_trait::async_trait;

    use super::*;

    /// Guarda as atividades e o último pedido.
    #[derive(Default)]
    pub struct AtividadesEmMemoria {
        pub atividades: Mutex<Vec<(Atividade, Option<String>)>>,
        pub ultimo_pedido: Mutex<Option<(Option<DateTime<Utc>>, u32)>>,
    }

    pub fn servicos_de_atividades() -> (ServicosDeAtividades, Arc<AtividadesEmMemoria>) {
        let repositorio = Arc::new(AtividadesEmMemoria::default());
        (
            ServicosDeAtividades {
                repositorio: repositorio.clone(),
            },
            repositorio,
        )
    }

    #[async_trait]
    impl RepositorioDeAtividades for AtividadesEmMemoria {
        async fn recentes(&self, antes: Option<DateTime<Utc>>, limite: u32) -> Result<Vec<(Atividade, Option<String>)>, FalhaExterna> {
            *self.ultimo_pedido.lock().unwrap() = Some((antes, limite));
            let mut todas: Vec<_> = self
                .atividades
                .lock()
                .unwrap()
                .iter()
                .filter(|(a, _)| antes.is_none_or(|antes| a.quando < antes))
                .cloned()
                .collect();
            todas.sort_by_key(|(a, _)| std::cmp::Reverse(a.quando));
            todas.truncate(limite as usize);
            Ok(todas)
        }
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::fakes::servicos_de_atividades;
    use super::*;
    use crate::modules::atividades::dominio::{LIMITE_MAXIMO, LIMITE_PADRAO};

    fn atividade(evento: Evento, segundos: i64) -> Atividade {
        Atividade {
            conta_id: Uuid::from_u128(1),
            nome: "Ana".into(),
            avatar: None,
            quando: DateTime::from_timestamp(1_800_000_000 + segundos, 0).unwrap(),
            evento,
        }
    }

    fn do_mania() -> Evento {
        Evento::PartidaDoMania {
            beatmap_id: 10,
            beatmapset_id: Some(7),
            titulo: None,
            artista: None,
            dificuldade: None,
            precisao: 0.97,
            derrota: false,
        }
    }

    #[tokio::test]
    async fn pede_o_limite_dentro_da_faixa_e_repassa_o_antes() {
        let (servicos, repositorio) = servicos_de_atividades();
        servicos.recentes(None, None).await.unwrap();
        assert_eq!(*repositorio.ultimo_pedido.lock().unwrap(), Some((None, LIMITE_PADRAO)));
        let antes = Utc::now();
        servicos.recentes(Some(antes), Some(9_999)).await.unwrap();
        assert_eq!(*repositorio.ultimo_pedido.lock().unwrap(), Some((Some(antes), LIMITE_MAXIMO)));
    }

    #[tokio::test]
    async fn a_partida_do_mania_ganha_o_nome_do_osu_guardado() {
        let (servicos, repositorio) = servicos_de_atividades();
        let osu = "osu file format v14\n\n[General]\nMode: 3\n\n[Metadata]\nTitle:Musica\nArtist:Banda\nVersion:Hard\n\n[Difficulty]\nCircleSize:4\nOverallDifficulty:8\nHPDrainRate:8\n\n[HitObjects]\n64,192,1000,1,0,0:0:0:0:\n";
        *repositorio.atividades.lock().unwrap() = vec![
            (atividade(do_mania(), 2), Some(osu.into())),
            (atividade(Evento::ContaNova, 1), None),
            (atividade(do_mania(), 0), None),
        ];
        let log = servicos.recentes(None, None).await.unwrap();
        assert!(matches!(&log[0].evento, Evento::PartidaDoMania { titulo: Some(t), dificuldade: Some(d), .. } if t == "Musica" && d == "Hard"));
        assert_eq!(log[1].evento, Evento::ContaNova);
        assert!(matches!(&log[2].evento, Evento::PartidaDoMania { titulo: None, .. }));
    }
}
