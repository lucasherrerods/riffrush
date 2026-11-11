use std::sync::Arc;

use super::dominio::{espera_da_tentativa, rejulgar, ChartGuardado, MAXIMO_DE_TENTATIVAS};
use super::estimativa::estimar_valor_no_score_v1;
use super::portas::{
    CacheDeCharts, ChartBaixado, FilaDoRejulgamento, FonteDeCharts, NoScoreV1, PartidaAntiga, PartidaDoJulgamentoAntigo, PartidaPendente, PartidasAntigas,
    PartidasDoJulgamentoAntigo,
};
use crate::modules::conta::{FalhaExterna, PartidaRejulgada, Relogio, ServicosDaConta};
use crate::modules::progresso::{precisao_pelo_valor, xp_da_partida, ResumoDaPartida};

pub const TAMANHO_DO_LOTE: u32 = 10;

#[derive(Clone)]
pub struct ServicosDoRejulgamento {
    pub fila: Arc<dyn FilaDoRejulgamento>,
    pub antigas: Arc<dyn PartidasAntigas>,
    pub julgamento_antigo: Arc<dyn PartidasDoJulgamentoAntigo>,
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

    /// Passa um lote das partidas julgadas antes do ScoreV1 para ele: com replay, rejulga pelo motor; sem,
    /// estima pelo valor guardado. O XP de cada uma é refeito e o da conta volta a ser a soma das partidas.
    /// Devolve quantas passou; com o Encore fora, para e tenta de novo depois.
    pub async fn passar_para_o_score_v1(&self) -> Result<usize, FalhaExterna> {
        let lote = self.julgamento_antigo.pegar_do_julgamento_antigo(TAMANHO_DO_LOTE).await?;
        let mut feitas = 0;
        for partida in lote {
            let Some(nova) = self.no_score_v1(&partida).await else {
                break;
            };
            let (resumo, precisao) = match &nova {
                NoScoreV1::Rejulgada(rejulgada) => (rejulgada.resumo, rejulgada.precisao),
                NoScoreV1::Estimada { valor_dos_acertos, precisao } => (
                    ResumoDaPartida {
                        valor_dos_acertos: Some(*valor_dos_acertos),
                        ..partida.resumo
                    },
                    *precisao,
                ),
            };
            let xp_ganho = if partida.rendia_xp {
                xp_da_partida(resumo, precisao, partida.repeticoes)
            } else {
                0
            };
            self.julgamento_antigo.gravar_no_score_v1(&partida, &nova, xp_ganho).await?;
            feitas += 1;
        }
        Ok(feitas)
    }

    /// `None` quando o chart está indisponível agora.
    async fn no_score_v1(&self, partida: &PartidaDoJulgamentoAntigo) -> Option<NoScoreV1> {
        if let Some(replay) = &partida.replay {
            match self.chart(&partida.md5).await {
                Ok(chart) => {
                    if let Ok(rejulgada) = rejulgar(&chart, partida.instrumento, partida.dificuldade, replay) {
                        return Some(NoScoreV1::Rejulgada(rejulgada));
                    }
                }
                Err(SemChart::Indisponivel) => return None,
                Err(SemChart::Desistir(_)) => {}
            }
        }
        let resumo = &partida.resumo;
        let valor_dos_acertos = estimar_valor_no_score_v1(resumo.acertos, resumo.valor_dos_acertos, partida.pesos);
        Some(NoScoreV1::Estimada {
            valor_dos_acertos,
            precisao: precisao_pelo_valor(u64::from(valor_dos_acertos), u64::from(resumo.total)),
        })
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

    #[derive(Default)]
    pub struct JulgamentoAntigoFalso {
        pub guardadas: Mutex<Vec<PartidaDoJulgamentoAntigo>>,
        pub gravadas: Mutex<Vec<(Uuid, NoScoreV1, u64)>>,
    }

    #[async_trait]
    impl PartidasDoJulgamentoAntigo for JulgamentoAntigoFalso {
        async fn pegar_do_julgamento_antigo(&self, limite: u32) -> Result<Vec<PartidaDoJulgamentoAntigo>, FalhaExterna> {
            let feitas: Vec<Uuid> = self.gravadas.lock().unwrap().iter().map(|(id, _, _)| *id).collect();
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
        async fn gravar_no_score_v1(&self, partida: &PartidaDoJulgamentoAntigo, nova: &NoScoreV1, xp_ganho: u64) -> Result<(), FalhaExterna> {
            self.gravadas.lock().unwrap().push((partida.id, nova.clone(), xp_ganho));
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

    use super::fakes::{AntigasFalsas, CacheFalso, EncoreFalso, FilaFalsa, JulgamentoAntigoFalso};
    use super::*;
    use crate::modules::conta::fakes::{pedido, servicos_com_fila, Banco};
    use crate::modules::progresso::ResumoDaPartida;
    use crate::modules::progresso::{Dificuldade, Instrumento};
    use crate::modules::rejulgamento::dominio::testes::{chart, replay};
    use crate::modules::rejulgamento::estimativa::PesosAntigos;

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
        julgamento_antigo: Arc<JulgamentoAntigoFalso>,
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
        let julgamento_antigo = Arc::new(JulgamentoAntigoFalso::default());
        let servicos = ServicosDoRejulgamento {
            fila: fila.clone(),
            antigas: antigas.clone(),
            julgamento_antigo: julgamento_antigo.clone(),
            cache: cache.clone(),
            fonte: encore.clone(),
            conta,
            relogio,
        };
        Cenario {
            servicos,
            fila,
            antigas,
            julgamento_antigo,
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
    fn do_julgamento_antigo(id: u128, replay: Option<Vec<u8>>, rendia_xp: bool) -> PartidaDoJulgamentoAntigo {
        PartidaDoJulgamentoAntigo {
            id: Uuid::from_u128(id),
            conta_id: Uuid::from_u128(99),
            md5: MD5.into(),
            dificuldade: Dificuldade::Expert,
            instrumento: Instrumento::Guitarra,
            replay,
            resumo: ResumoDaPartida {
                dificuldade: Dificuldade::Expert,
                acertos: 200,
                total: 200,
                derrota: false,
                fantasma: false,
                maior_sequencia: Some(200),
                valor_dos_acertos: Some(50_000),
            },
            pesos: PesosAntigos::Segundos,
            rendia_xp,
            repeticoes: 1,
        }
    }

    #[tokio::test]
    async fn no_score_v1_a_partida_com_replay_e_rejulgada_pelo_motor() {
        let guardado = chart();
        let c = cenario(Ok(Some(sng(&guardado)))).await;
        let com_replay = do_julgamento_antigo(1, Some(replay(&guardado, &[(0, 0.0), (1, 0.0), (2, 0.0)])), true);
        c.julgamento_antigo.guardadas.lock().unwrap().push(com_replay);
        assert_eq!(c.servicos.passar_para_o_score_v1().await.unwrap(), 1);
        let gravadas = c.julgamento_antigo.gravadas.lock().unwrap();
        assert!(matches!(gravadas[0].1, NoScoreV1::Rejulgada(_)));
    }

    #[tokio::test]
    async fn no_score_v1_sem_replay_estima_a_precisao_e_refaz_o_xp_com_ela() {
        let c = cenario(Ok(None)).await;
        c.julgamento_antigo.guardadas.lock().unwrap().push(do_julgamento_antigo(1, None, true));
        assert_eq!(c.servicos.passar_para_o_score_v1().await.unwrap(), 1);
        let gravadas = c.julgamento_antigo.gravadas.lock().unwrap();
        let valor = estimar_valor_no_score_v1(200, Some(50_000), PesosAntigos::Segundos);
        let precisao = precisao_pelo_valor(u64::from(valor), 200);
        assert_eq!(
            gravadas[0].1,
            NoScoreV1::Estimada {
                valor_dos_acertos: valor,
                precisao
            }
        );
        let resumo = ResumoDaPartida {
            valor_dos_acertos: Some(valor),
            ..do_julgamento_antigo(1, None, true).resumo
        };
        assert_eq!(gravadas[0].2, xp_da_partida(resumo, precisao, 1));
        assert!(gravadas[0].2 > 0);
        // Sem replay não precisa do Encore.
        assert_eq!(*c.encore.chamadas.lock().unwrap(), 0);
    }

    #[tokio::test]
    async fn no_score_v1_a_desistencia_que_nao_rendia_xp_continua_sem() {
        let c = cenario(Ok(None)).await;
        c.julgamento_antigo.guardadas.lock().unwrap().push(do_julgamento_antigo(1, None, false));
        c.servicos.passar_para_o_score_v1().await.unwrap();
        assert_eq!(c.julgamento_antigo.gravadas.lock().unwrap()[0].2, 0);
    }

    #[tokio::test]
    async fn no_score_v1_o_replay_que_o_motor_recusa_ou_o_chart_que_sumiu_viram_estimativa() {
        let guardado = chart();
        let c = cenario(Ok(Some(sng(&guardado)))).await;
        c.julgamento_antigo
            .guardadas
            .lock()
            .unwrap()
            .push(do_julgamento_antigo(1, Some(vec![9, 9]), true));
        c.servicos.passar_para_o_score_v1().await.unwrap();
        let sumiu = cenario(Ok(None)).await;
        sumiu
            .julgamento_antigo
            .guardadas
            .lock()
            .unwrap()
            .push(do_julgamento_antigo(2, Some(vec![9, 9]), true));
        sumiu.servicos.passar_para_o_score_v1().await.unwrap();
        assert!(matches!(c.julgamento_antigo.gravadas.lock().unwrap()[0].1, NoScoreV1::Estimada { .. }));
        assert!(matches!(sumiu.julgamento_antigo.gravadas.lock().unwrap()[0].1, NoScoreV1::Estimada { .. }));
    }

    #[tokio::test]
    async fn no_score_v1_com_o_encore_fora_para_e_tenta_depois() {
        let guardado = chart();
        let c = cenario(Err("fora do ar".into())).await;
        c.julgamento_antigo
            .guardadas
            .lock()
            .unwrap()
            .push(do_julgamento_antigo(1, Some(replay(&guardado, &[(0, 0.0)])), true));
        assert_eq!(c.servicos.passar_para_o_score_v1().await.unwrap(), 0);
        assert!(c.julgamento_antigo.gravadas.lock().unwrap().is_empty());
    }
}
