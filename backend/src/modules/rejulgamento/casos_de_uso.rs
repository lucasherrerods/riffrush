use std::sync::Arc;

use super::dominio::{espera_da_tentativa, rejulgar, ChartGuardado, MAXIMO_DE_TENTATIVAS};
use super::portas::{CacheDeCharts, ChartBaixado, FilaDoRejulgamento, FonteDeCharts, PartidaAntiga, PartidaPendente, PartidasAntigas};
use crate::modules::conta::{FalhaExterna, PartidaRejulgada, Relogio, ServicosDaConta};

pub const TAMANHO_DO_LOTE: u32 = 10;

#[derive(Clone)]
pub struct ServicosDoRejulgamento {
    pub fila: Arc<dyn FilaDoRejulgamento>,
    pub antigas: Arc<dyn PartidasAntigas>,
    pub cache: Arc<dyn CacheDeCharts>,
    pub fonte: Arc<dyn FonteDeCharts>,
    pub conta: ServicosDaConta,
    pub relogio: Arc<dyn Relogio>,
}

/// O que deu cada partida do lote.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Desfecho {
    Registrada,
    Reagendada,
    Desistida(String),
}

enum SemChart {
    /// Tenta de novo mais tarde.
    Indisponivel,
    Desistir(String),
}

impl ServicosDoRejulgamento {
    /// Rejulga as partidas na vez. Devolve o desfecho de cada uma (vazio: não tinha nada na fila).
    pub async fn processar_lote(&self) -> Result<Vec<Desfecho>, FalhaExterna> {
        let lote = self.fila.pegar(TAMANHO_DO_LOTE, self.relogio.agora()).await?;
        let mut desfechos = Vec::with_capacity(lote.len());
        for partida in lote {
            desfechos.push(self.processar(partida).await?);
        }
        Ok(desfechos)
    }

    /// Rejulga com as regras do Clone Hero um lote das partidas guardadas com as regras antigas.
    /// Devolve quantas mudaram de estado; com o Encore fora, para e tenta de novo depois.
    pub async fn rejulgar_antigas(&self) -> Result<usize, FalhaExterna> {
        let lote = self.antigas.pegar_antigas(TAMANHO_DO_LOTE).await?;
        let mut feitas = 0;
        for partida in lote {
            if !self.rejulgar_antiga(&partida).await? {
                break;
            }
            feitas += 1;
        }
        Ok(feitas)
    }

    /// `false` quando o chart está indisponível agora.
    async fn rejulgar_antiga(&self, partida: &PartidaAntiga) -> Result<bool, FalhaExterna> {
        let chart = match self.chart(&partida.md5).await {
            Ok(chart) => chart,
            Err(SemChart::Indisponivel) => return Ok(false),
            Err(SemChart::Desistir(motivo)) => {
                tracing::info!(partida = %partida.id, %motivo, "partida antiga sem como rejulgar");
                self.antigas.sem_como_rejulgar(partida.id).await?;
                return Ok(true);
            }
        };
        match rejulgar(&chart, partida.instrumento, partida.dificuldade, &partida.replay) {
            Ok(rejulgada) => self.antigas.atualizar(partida.id, &rejulgada).await?,
            Err(recusa) => {
                tracing::info!(partida = %partida.id, %recusa, "partida antiga sem como rejulgar");
                self.antigas.sem_como_rejulgar(partida.id).await?;
            }
        }
        Ok(true)
    }

    async fn processar(&self, partida: PartidaPendente) -> Result<Desfecho, FalhaExterna> {
        let chart = match self.chart(&partida.md5).await {
            Ok(chart) => chart,
            Err(SemChart::Indisponivel) => return self.reagendar(&partida).await,
            Err(SemChart::Desistir(motivo)) => return self.desistir(&partida, motivo).await,
        };
        let rejulgada = match rejulgar(&chart, partida.instrumento, partida.dificuldade, &partida.replay) {
            Ok(rejulgada) => rejulgada,
            Err(recusa) => return self.desistir(&partida, recusa.to_string()).await,
        };
        let registro = self
            .conta
            .registrar_partida_rejulgada(PartidaRejulgada {
                id: partida.id,
                conta_id: partida.conta_id,
                musica_id: format!("encore:{}", partida.md5),
                instrumento: partida.instrumento,
                pontos: rejulgada.pontos,
                resumo: rejulgada.resumo,
                precisao: rejulgada.precisao,
                sem_falha: rejulgada.sem_falha,
                jeito_de_jogar: rejulgada.jeito_de_jogar,
                velocidade: rejulgada.velocidade,
                jogada_em: partida.enviada_em,
                replay: partida.replay.clone(),
                rodada: partida.rodada,
            })
            .await;
        if let Err(erro) = registro {
            tracing::warn!(partida = %partida.id, %erro, "não deu para registrar a partida rejulgada");
            return self.reagendar(&partida).await;
        }
        self.fila.concluir(partida.id).await?;
        Ok(Desfecho::Registrada)
    }

    /// O chart do cache; na primeira vez, baixado do Encore e guardado sem o áudio.
    async fn chart(&self, md5: &str) -> Result<ChartGuardado, SemChart> {
        match self.cache.buscar(md5).await {
            Ok(Some(chart)) => return Ok(chart),
            Ok(None) => {}
            Err(falha) => {
                tracing::warn!(%falha, "cache de charts fora");
                return Err(SemChart::Indisponivel);
            }
        }
        let chart = match self.fonte.baixar(md5).await {
            Ok(ChartBaixado::Pronto(chart)) => chart,
            Ok(ChartBaixado::NaoExiste) => return Err(SemChart::Desistir("o chart não existe no Encore".into())),
            Ok(ChartBaixado::Ilegivel) => return Err(SemChart::Desistir("o .sng do Encore é ilegível".into())),
            Err(falha) => {
                tracing::info!(%falha, "Encore indisponível, a partida espera");
                return Err(SemChart::Indisponivel);
            }
        };
        if let Err(falha) = self.cache.guardar(md5, &chart).await {
            tracing::warn!(%falha, "não deu para guardar o chart");
        }
        Ok(chart)
    }

    async fn reagendar(&self, partida: &PartidaPendente) -> Result<Desfecho, FalhaExterna> {
        if partida.tentativas >= MAXIMO_DE_TENTATIVAS {
            return self.desistir(partida, "tentativas esgotadas".into()).await;
        }
        self.fila
            .reagendar(partida.id, self.relogio.agora() + espera_da_tentativa(partida.tentativas))
            .await?;
        Ok(Desfecho::Reagendada)
    }

    async fn desistir(&self, partida: &PartidaPendente, motivo: String) -> Result<Desfecho, FalhaExterna> {
        tracing::info!(partida = %partida.id, %motivo, "partida fora do rejulgamento");
        self.fila.desistir(partida.id, &motivo).await?;
        Ok(Desfecho::Desistida(motivo))
    }
}

/// Fakes das portas, para os testes daqui.
#[cfg(test)]
mod fakes {
    use std::collections::HashMap;
    use std::sync::Mutex;

    use async_trait::async_trait;
    use chrono::{DateTime, Utc};
    use uuid::Uuid;

    use super::*;

    #[derive(Default)]
    pub struct FilaFalsa {
        pub na_vez: Mutex<Vec<PartidaPendente>>,
        pub concluidas: Mutex<Vec<Uuid>>,
        pub reagendadas: Mutex<Vec<(Uuid, DateTime<Utc>)>>,
        pub desistidas: Mutex<Vec<(Uuid, String)>>,
    }

    #[async_trait]
    impl FilaDoRejulgamento for FilaFalsa {
        async fn pegar(&self, limite: u32, _agora: DateTime<Utc>) -> Result<Vec<PartidaPendente>, FalhaExterna> {
            let mut na_vez = self.na_vez.lock().unwrap();
            let quantas = na_vez.len().min(limite as usize);
            Ok(na_vez.drain(..quantas).collect())
        }
        async fn concluir(&self, id: Uuid) -> Result<(), FalhaExterna> {
            self.concluidas.lock().unwrap().push(id);
            Ok(())
        }
        async fn reagendar(&self, id: Uuid, quando: DateTime<Utc>) -> Result<(), FalhaExterna> {
            self.reagendadas.lock().unwrap().push((id, quando));
            Ok(())
        }
        async fn desistir(&self, id: Uuid, motivo: &str) -> Result<(), FalhaExterna> {
            self.desistidas.lock().unwrap().push((id, motivo.into()));
            Ok(())
        }
    }

    #[derive(Default)]
    pub struct AntigasFalsas {
        pub guardadas: Mutex<Vec<PartidaAntiga>>,
        pub atualizadas: Mutex<Vec<(Uuid, crate::modules::rejulgamento::Rejulgada)>>,
        pub sem_como: Mutex<Vec<Uuid>>,
    }

    #[async_trait]
    impl PartidasAntigas for AntigasFalsas {
        async fn pegar_antigas(&self, limite: u32) -> Result<Vec<PartidaAntiga>, FalhaExterna> {
            let feitas: Vec<Uuid> = self
                .atualizadas
                .lock()
                .unwrap()
                .iter()
                .map(|(id, _)| *id)
                .chain(self.sem_como.lock().unwrap().iter().copied())
                .collect();
            Ok(self
                .guardadas
                .lock()
                .unwrap()
                .iter()
                .filter(|p| !feitas.contains(&p.id))
                .take(limite as usize)
                .cloned()
                .collect())
        }
        async fn atualizar(&self, id: Uuid, rejulgada: &crate::modules::rejulgamento::Rejulgada) -> Result<(), FalhaExterna> {
            self.atualizadas.lock().unwrap().push((id, rejulgada.clone()));
            Ok(())
        }
        async fn sem_como_rejulgar(&self, id: Uuid) -> Result<(), FalhaExterna> {
            self.sem_como.lock().unwrap().push(id);
            Ok(())
        }
    }

    #[derive(Default)]
    pub struct CacheFalso(pub Mutex<HashMap<String, ChartGuardado>>);

    #[async_trait]
    impl CacheDeCharts for CacheFalso {
        async fn buscar(&self, md5: &str) -> Result<Option<ChartGuardado>, FalhaExterna> {
            Ok(self.0.lock().unwrap().get(md5).cloned())
        }
        async fn guardar(&self, md5: &str, chart: &ChartGuardado) -> Result<(), FalhaExterna> {
            self.0.lock().unwrap().insert(md5.into(), chart.clone());
            Ok(())
        }
    }

    /// Responde sempre o mesmo e conta quantas vezes foi chamado.
    pub struct EncoreFalso {
        pub resposta: Result<Option<Vec<u8>>, String>,
        pub chamadas: Mutex<u32>,
    }

    #[async_trait]
    impl FonteDeCharts for EncoreFalso {
        async fn baixar(&self, _md5: &str) -> Result<ChartBaixado, FalhaExterna> {
            *self.chamadas.lock().unwrap() += 1;
            // Passa o .sng pelo mesmo extrator do download de verdade.
            Ok(match self.resposta.clone().map_err(FalhaExterna)? {
                Some(sng) => riffrush_motor::extrair_chart(&sng).map_or(ChartBaixado::Ilegivel, ChartBaixado::Pronto),
                None => ChartBaixado::NaoExiste,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use chrono::Duration;
    use uuid::Uuid;

    use super::fakes::{AntigasFalsas, CacheFalso, EncoreFalso, FilaFalsa};
    use super::*;
    use crate::modules::conta::fakes::{pedido, servicos_com_fila, Banco};
    use crate::modules::progresso::{Dificuldade, Instrumento};
    use crate::modules::rejulgamento::dominio::testes::{chart, replay};

    const MD5: &str = "fb0079d4c2e025d5b8dd70724750a923";

    /// Um .sng só com o chart e a máscara zerada, como o Encore entrega (o áudio aqui não importa).
    fn sng(chart: &ChartGuardado) -> Vec<u8> {
        let nome = b"notes.chart";
        let mut bytes = b"SNGPKG".to_vec();
        bytes.extend(1u32.to_le_bytes());
        bytes.extend([0u8; 16]);
        bytes.extend(8u64.to_le_bytes());
        bytes.extend(0u64.to_le_bytes());
        bytes.extend((8 + 1 + nome.len() as u64 + 16).to_le_bytes());
        bytes.extend(1u64.to_le_bytes());
        bytes.push(nome.len() as u8);
        bytes.extend(nome);
        bytes.extend((chart.arquivo.len() as u64).to_le_bytes());
        let inicio = bytes.len() as u64 + 8 + 8;
        bytes.extend(inicio.to_le_bytes());
        bytes.extend((chart.arquivo.len() as u64).to_le_bytes());
        bytes.extend(chart.arquivo.iter().enumerate().map(|(j, b)| b ^ (j & 0xff) as u8));
        bytes
    }

    struct Cenario {
        servicos: ServicosDoRejulgamento,
        fila: Arc<FilaFalsa>,
        antigas: Arc<AntigasFalsas>,
        cache: Arc<CacheFalso>,
        encore: Arc<EncoreFalso>,
        banco: Arc<Banco>,
        conta_id: Uuid,
    }

    async fn cenario(resposta: Result<Option<Vec<u8>>, String>) -> Cenario {
        let (conta, banco, relogio, _) = servicos_com_fila();
        let conta_id = conta.entrar_com_google(&pedido("bom")).await.unwrap().conta.id;
        let fila = Arc::new(FilaFalsa::default());
        let cache = Arc::new(CacheFalso::default());
        let encore = Arc::new(EncoreFalso {
            resposta,
            chamadas: Mutex::new(0),
        });
        let antigas = Arc::new(AntigasFalsas::default());
        let servicos = ServicosDoRejulgamento {
            fila: fila.clone(),
            antigas: antigas.clone(),
            cache: cache.clone(),
            fonte: encore.clone(),
            conta,
            relogio,
        };
        Cenario {
            servicos,
            fila,
            antigas,
            cache,
            encore,
            banco,
            conta_id,
        }
    }

    fn pendente(id: u128, conta_id: Uuid, replay: Vec<u8>, tentativas: u32) -> PartidaPendente {
        PartidaPendente {
            id: Uuid::from_u128(id),
            conta_id,
            md5: MD5.into(),
            dificuldade: Dificuldade::Expert,
            instrumento: Instrumento::Guitarra,
            replay,
            enviada_em: chrono::Utc::now(),
            tentativas,
            rodada: None,
        }
    }

    #[tokio::test]
    async fn baixa_o_chart_uma_vez_rejulga_e_registra_com_os_numeros_do_servidor() {
        let chart = chart();
        let c = cenario(Ok(Some(sng(&chart)))).await;
        let replay = replay(&chart, &[(0, 0.0), (1, 0.0), (2, 0.0), (3, 0.0)]);
        c.fila.na_vez.lock().unwrap().push(pendente(9, c.conta_id, replay.clone(), 1));
        assert_eq!(c.servicos.processar_lote().await.unwrap(), [Desfecho::Registrada]);
        assert_eq!(*c.fila.concluidas.lock().unwrap(), [Uuid::from_u128(9)]);
        assert_eq!(c.cache.0.lock().unwrap().get(MD5), Some(&chart));
        assert_eq!(c.banco.partidas.lock().unwrap().len(), 1);

        // A segunda partida da mesma música usa o cache.
        c.fila.na_vez.lock().unwrap().push(pendente(10, c.conta_id, replay, 1));
        c.servicos.processar_lote().await.unwrap();
        assert_eq!(*c.encore.chamadas.lock().unwrap(), 1);
        assert_eq!(c.banco.partidas.lock().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn encore_fora_do_ar_reagenda_e_desiste_depois_de_muitas_tentativas() {
        let c = cenario(Err("timeout".into())).await;
        c.fila.na_vez.lock().unwrap().push(pendente(9, c.conta_id, vec![2, 0], 2));
        assert_eq!(c.servicos.processar_lote().await.unwrap(), [Desfecho::Reagendada]);
        let (_, quando) = c.fila.reagendadas.lock().unwrap()[0];
        assert_eq!(quando - c.servicos.relogio.agora(), Duration::minutes(2));

        c.fila.na_vez.lock().unwrap().push(pendente(9, c.conta_id, vec![2, 0], 20));
        assert_eq!(c.servicos.processar_lote().await.unwrap(), [Desfecho::Desistida("tentativas esgotadas".into())]);
    }

    #[tokio::test]
    async fn replay_de_outro_chart_e_chart_que_sumiu_nao_valem() {
        let chart = chart();
        let c = cenario(Ok(Some(sng(&chart)))).await;
        let outro = ChartGuardado {
            atraso_ms: 50.0,
            ..chart.clone()
        };
        c.fila.na_vez.lock().unwrap().push(pendente(9, c.conta_id, replay(&outro, &[(0, 0.0)]), 1));
        assert_eq!(
            c.servicos.processar_lote().await.unwrap(),
            [Desfecho::Desistida("o replay é de outro chart".into())]
        );
        assert!(c.banco.partidas.lock().unwrap().is_empty());

        let sumiu = cenario(Ok(None)).await;
        sumiu.fila.na_vez.lock().unwrap().push(pendente(9, sumiu.conta_id, vec![2, 0], 1));
        assert_eq!(
            sumiu.servicos.processar_lote().await.unwrap(),
            [Desfecho::Desistida("o chart não existe no Encore".into())]
        );
    }

    #[tokio::test]
    async fn sng_sem_chart_que_de_para_ler_nao_vale() {
        let c = cenario(Ok(Some(b"SNGPKG nada aqui".to_vec()))).await;
        c.fila.na_vez.lock().unwrap().push(pendente(9, c.conta_id, vec![2, 0], 1));
        assert_eq!(
            c.servicos.processar_lote().await.unwrap(),
            [Desfecho::Desistida("o .sng do Encore é ilegível".into())]
        );
    }

    #[tokio::test]
    async fn as_partidas_antigas_sao_rejulgadas_com_as_regras_novas_e_as_sem_chart_saem() {
        let guardado = chart();
        let c = cenario(Ok(Some(sng(&guardado)))).await;
        let (boa, sem_chart) = (Uuid::from_u128(1), Uuid::from_u128(2));
        c.antigas.guardadas.lock().unwrap().extend([
            PartidaAntiga {
                id: boa,
                md5: MD5.into(),
                dificuldade: Dificuldade::Expert,
                instrumento: Instrumento::Guitarra,
                replay: replay(&guardado, &[(0, 0.0), (1, 0.0), (2, 0.0)]),
            },
            PartidaAntiga {
                id: sem_chart,
                md5: MD5.into(),
                dificuldade: Dificuldade::Expert,
                instrumento: Instrumento::Guitarra,
                replay: vec![9, 9],
            },
        ]);
        assert_eq!(c.servicos.rejulgar_antigas().await.unwrap(), 2);
        let atualizadas: Vec<(Uuid, f64)> = c.antigas.atualizadas.lock().unwrap().iter().map(|(id, r)| (*id, r.velocidade)).collect();
        assert_eq!(atualizadas, [(boa, 1.0)]);
        assert_eq!(*c.antigas.sem_como.lock().unwrap(), [sem_chart]);
        assert_eq!(c.servicos.rejulgar_antigas().await.unwrap(), 0);
    }
}
