use std::sync::Arc;

use chrono::Duration;
use uuid::Uuid;

use super::dominio::{rejulgar, status_vale_xp, vale_ranking, xp_do_mania, TAMANHO_MAXIMO_DO_REPLAY};
use super::portas::{
    BeatmapBaixado, BeatmapDoOsu, FonteDeBeatmaps, LinhaDoRanking, PartidaGuardada, PartidaNaFila, PartidaPendente, PartidaRegistrada, RepositorioDoMania,
};
use crate::modules::conta::{pode_registrar, ErroDaConta, FalhaExterna, Gerador, Relogio, ServicosDaConta};
use crate::modules::progresso::{nivel_do_xp, Nivel};

pub const TAMANHO_DO_LOTE: u32 = 10;
/// O XP cai para quem repete o mesmo mapa dentro deste tempo, como no Rock.
const JANELA_DAS_REPETICOES: Duration = Duration::hours(24);
/// Depois disso a partida fica marcada como perdida, para alguém olhar o motivo.
const MAXIMO_DE_TENTATIVAS: u32 = 20;
/// Sem espaço no limite de pedidos ao osu!, a partida tenta de novo logo.
const ESPERA_DO_LIMITE: Duration = Duration::seconds(30);
pub const TAMANHO_DO_RANKING: u32 = 10;

#[derive(Clone)]
pub struct ServicosDoMania {
    pub repositorio: Arc<dyn RepositorioDoMania>,
    pub fonte: Arc<dyn FonteDeBeatmaps>,
    pub conta: ServicosDaConta,
    pub relogio: Arc<dyn Relogio>,
    pub gerador: Arc<dyn Gerador>,
}

#[derive(Debug, thiserror::Error)]
pub enum ErroDoMania {
    #[error(transparent)]
    Conta(#[from] ErroDaConta),
    #[error("replay inválido")]
    ReplayInvalido,
    #[error("id do mapa inválido")]
    MapaInvalido,
    #[error("partidas rápidas demais")]
    RapidoDemais,
    #[error("partida não encontrada")]
    NaoEncontrada,
    #[error(transparent)]
    Falha(#[from] FalhaExterna),
}

#[derive(Debug, PartialEq, Eq)]
pub enum Situacao {
    Registrada { xp_ganho: u64, antes: Nivel, depois: Nivel },
    NaFila,
    Recusada,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Desfecho {
    Registrada,
    Reagendada,
    Desistida(String),
}

enum SemBeatmap {
    Esperar(Duration),
    Desistir(String),
}

/// Espera antes de tentar de novo: dobra a cada tentativa, de 1 minuto até 6 horas.
fn espera_da_tentativa(tentativas: u32) -> Duration {
    (Duration::minutes(1) * 2_i32.pow(tentativas.saturating_sub(1).min(16))).min(Duration::hours(6))
}

impl ServicosDoMania {
    /// O app manda o replay; o XP entra quando o servidor terminar de rejulgar.
    pub async fn enviar_partida(&self, token: &str, beatmap_id: u64, replay: Vec<u8>) -> Result<Uuid, ErroDoMania> {
        let conta = self.conta.conta_da_sessao(token).await?;
        if beatmap_id == 0 || beatmap_id > i64::MAX as u64 {
            return Err(ErroDoMania::MapaInvalido);
        }
        if replay.len() > TAMANHO_MAXIMO_DO_REPLAY || riffrush_motor_mania::desempacotar_replay(&replay).is_err() {
            return Err(ErroDoMania::ReplayInvalido);
        }
        let agora = self.relogio.agora();
        if !pode_registrar(self.repositorio.ultima_partida(conta.id).await?, agora) {
            return Err(ErroDoMania::RapidoDemais);
        }
        let id = self.gerador.id();
        self.repositorio
            .enfileirar(&PartidaNaFila {
                id,
                conta_id: conta.id,
                beatmap_id,
                replay,
                enviada_em: agora,
            })
            .await?;
        Ok(id)
    }

    pub async fn situacao(&self, token: &str, id: Uuid) -> Result<Situacao, ErroDoMania> {
        let conta = self.conta.conta_da_sessao(token).await?;
        Ok(match self.repositorio.situacao(conta.id, id).await?.ok_or(ErroDoMania::NaoEncontrada)? {
            PartidaGuardada::Registrada { xp_ganho } => Situacao::Registrada {
                xp_ganho,
                antes: nivel_do_xp(conta.xp_total.saturating_sub(xp_ganho)),
                depois: conta.nivel(),
            },
            PartidaGuardada::NaFila => Situacao::NaFila,
            PartidaGuardada::Recusada => Situacao::Recusada,
        })
    }

    pub async fn ranking(&self, beatmap_id: u64, token: Option<&str>) -> Result<Vec<LinhaDoRanking>, ErroDoMania> {
        let conta = match token {
            Some(token) => self.conta.conta_da_sessao(token).await.ok().map(|c| c.id),
            None => None,
        };
        Ok(self.repositorio.ranking(beatmap_id, TAMANHO_DO_RANKING, conta).await?)
    }

    pub async fn replay(&self, partida_id: Uuid) -> Result<Vec<u8>, ErroDoMania> {
        self.repositorio.replay(partida_id).await?.ok_or(ErroDoMania::NaoEncontrada)
    }

    /// Rejulga as partidas na vez. Devolve o desfecho de cada uma (vazio: não tinha nada na fila).
    pub async fn processar_lote(&self) -> Result<Vec<Desfecho>, FalhaExterna> {
        let lote = self.repositorio.pegar(TAMANHO_DO_LOTE, self.relogio.agora()).await?;
        let mut desfechos = Vec::with_capacity(lote.len());
        for pendente in lote {
            desfechos.push(self.processar(pendente).await?);
        }
        Ok(desfechos)
    }

    async fn processar(&self, pendente: PartidaPendente) -> Result<Desfecho, FalhaExterna> {
        let partida = &pendente.partida;
        let beatmap = match self.beatmap(partida.beatmap_id).await {
            Ok(beatmap) => beatmap,
            Err(SemBeatmap::Esperar(espera)) => return self.reagendar(&pendente, espera).await,
            Err(SemBeatmap::Desistir(motivo)) => return self.desistir(&pendente, motivo).await,
        };
        let rejulgada = match rejulgar(&beatmap.texto, &partida.replay) {
            Ok(rejulgada) => rejulgada,
            Err(recusa) => return self.desistir(&pendente, recusa.to_string()).await,
        };
        let xp_ganho = if status_vale_xp(&beatmap.status) {
            let repeticoes = self
                .repositorio
                .partidas_no_mapa(partida.conta_id, partida.beatmap_id, partida.enviada_em - JANELA_DAS_REPETICOES, partida.id)
                .await?;
            xp_do_mania(beatmap.estrelas, &rejulgada, repeticoes)
        } else {
            0
        };
        let no_ranking = vale_ranking(&beatmap.status, &rejulgada);
        let registro = self
            .repositorio
            .registrar(&PartidaRegistrada {
                id: partida.id,
                conta_id: partida.conta_id,
                beatmap_id: partida.beatmap_id,
                beatmapset_id: beatmap.beatmapset_id,
                pontuacao: rejulgada.pontuacao,
                precisao: rejulgada.precisao,
                contagem: rejulgada.contagem,
                maior_combo: rejulgada.maior_combo,
                derrota: rejulgada.derrota,
                mods: rejulgada.mods,
                xp_ganho,
                vale_ranking: no_ranking,
                replay: no_ranking.then(|| partida.replay.clone()),
                jogada_em: partida.enviada_em,
            })
            .await;
        if let Err(falha) = registro {
            tracing::warn!(partida = %partida.id, %falha, "não deu para registrar a partida do Mania");
            return self.reagendar(&pendente, espera_da_tentativa(pendente.tentativas)).await;
        }
        Ok(Desfecho::Registrada)
    }

    /// O .osu do cache; na primeira vez, baixado do osu! e guardado se o mapa não muda mais.
    async fn beatmap(&self, beatmap_id: u64) -> Result<BeatmapDoOsu, SemBeatmap> {
        match self.repositorio.beatmap(beatmap_id).await {
            Ok(Some(beatmap)) => return Ok(beatmap),
            Ok(None) => {}
            Err(falha) => {
                tracing::warn!(%falha, "cache de beatmaps fora");
                return Err(SemBeatmap::Esperar(Duration::minutes(1)));
            }
        }
        match self.repositorio.pedir_ao_osu(self.relogio.agora()).await {
            Ok(true) => {}
            Ok(false) => return Err(SemBeatmap::Esperar(ESPERA_DO_LIMITE)),
            Err(falha) => {
                tracing::warn!(%falha, "limite de pedidos ao osu! fora");
                return Err(SemBeatmap::Esperar(Duration::minutes(1)));
            }
        }
        let beatmap = match self.fonte.baixar(beatmap_id).await {
            Ok(BeatmapBaixado::Pronto(beatmap)) => beatmap,
            Ok(BeatmapBaixado::NaoExiste) => return Err(SemBeatmap::Desistir("o mapa não existe no osu!".into())),
            Ok(BeatmapBaixado::NaoEhMania) => return Err(SemBeatmap::Desistir("o mapa não é do modo mania".into())),
            Err(falha) => {
                tracing::info!(%falha, "osu! indisponível, a partida espera");
                return Err(SemBeatmap::Esperar(Duration::minutes(5)));
            }
        };
        // Um mapa pending ou graveyard ainda pode mudar: só os que não mudam ficam guardados para sempre.
        if status_vale_xp(&beatmap.status) {
            if let Err(falha) = self.repositorio.guardar_beatmap(&beatmap).await {
                tracing::warn!(%falha, "não deu para guardar o beatmap");
            }
        }
        Ok(beatmap)
    }

    async fn reagendar(&self, pendente: &PartidaPendente, espera: Duration) -> Result<Desfecho, FalhaExterna> {
        if pendente.tentativas >= MAXIMO_DE_TENTATIVAS {
            return self.desistir(pendente, "tentativas esgotadas".into()).await;
        }
        self.repositorio.reagendar(pendente.partida.id, self.relogio.agora() + espera).await?;
        Ok(Desfecho::Reagendada)
    }

    async fn desistir(&self, pendente: &PartidaPendente, motivo: String) -> Result<Desfecho, FalhaExterna> {
        tracing::info!(partida = %pendente.partida.id, %motivo, "partida do Mania fora do rejulgamento");
        self.repositorio.desistir(pendente.partida.id, &motivo).await?;
        Ok(Desfecho::Desistida(motivo))
    }
}

/// Fakes das portas, para os testes daqui e os de integração.
#[cfg(any(test, feature = "testes"))]
pub mod fakes {
    use std::collections::HashMap;
    use std::sync::Mutex;

    use async_trait::async_trait;
    use chrono::{DateTime, Utc};

    use super::*;
    use crate::modules::conta::fakes::{GeradorEmSequencia, RelogioFalso};

    #[derive(Default)]
    pub struct ManiaEmMemoria {
        pub fila: Mutex<Vec<PartidaPendente>>,
        pub desistidas: Mutex<Vec<(Uuid, String)>>,
        pub reagendadas: Mutex<Vec<(Uuid, DateTime<Utc>)>>,
        pub registradas: Mutex<Vec<PartidaRegistrada>>,
        pub beatmaps: Mutex<HashMap<u64, BeatmapDoOsu>>,
        /// Quantos pedidos ao osu! ainda cabem no limite.
        pub pedidos_que_cabem: Mutex<u32>,
    }

    impl ManiaEmMemoria {
        pub fn novo() -> Self {
            Self {
                pedidos_que_cabem: Mutex::new(u32::MAX),
                ..Self::default()
            }
        }
    }

    #[async_trait]
    impl RepositorioDoMania for ManiaEmMemoria {
        async fn enfileirar(&self, partida: &PartidaNaFila) -> Result<(), FalhaExterna> {
            self.fila.lock().unwrap().push(PartidaPendente {
                partida: partida.clone(),
                tentativas: 0,
            });
            Ok(())
        }
        async fn ultima_partida(&self, conta_id: Uuid) -> Result<Option<DateTime<Utc>>, FalhaExterna> {
            let na_fila = self
                .fila
                .lock()
                .unwrap()
                .iter()
                .filter(|p| p.partida.conta_id == conta_id)
                .map(|p| p.partida.enviada_em)
                .max();
            let registradas = self
                .registradas
                .lock()
                .unwrap()
                .iter()
                .filter(|p| p.conta_id == conta_id)
                .map(|p| p.jogada_em)
                .max();
            Ok(na_fila.max(registradas))
        }
        async fn pegar(&self, limite: u32, _agora: DateTime<Utc>) -> Result<Vec<PartidaPendente>, FalhaExterna> {
            let mut fila = self.fila.lock().unwrap();
            let quantas = fila.len().min(limite as usize);
            Ok(fila
                .drain(..quantas)
                .map(|p| PartidaPendente {
                    tentativas: p.tentativas + 1,
                    ..p
                })
                .collect())
        }
        async fn reagendar(&self, id: Uuid, quando: DateTime<Utc>) -> Result<(), FalhaExterna> {
            self.reagendadas.lock().unwrap().push((id, quando));
            Ok(())
        }
        async fn desistir(&self, id: Uuid, motivo: &str) -> Result<(), FalhaExterna> {
            self.desistidas.lock().unwrap().push((id, motivo.into()));
            Ok(())
        }
        async fn registrar(&self, partida: &PartidaRegistrada) -> Result<(), FalhaExterna> {
            let mut registradas = self.registradas.lock().unwrap();
            if !registradas.iter().any(|p| p.id == partida.id) {
                registradas.push(partida.clone());
            }
            Ok(())
        }
        async fn partidas_no_mapa(&self, conta_id: Uuid, beatmap_id: u64, desde: DateTime<Utc>, exceto: Uuid) -> Result<u32, FalhaExterna> {
            Ok(self
                .registradas
                .lock()
                .unwrap()
                .iter()
                .filter(|p| p.conta_id == conta_id && p.beatmap_id == beatmap_id && p.jogada_em >= desde && p.id != exceto)
                .count() as u32)
        }
        async fn situacao(&self, conta_id: Uuid, id: Uuid) -> Result<Option<PartidaGuardada>, FalhaExterna> {
            if let Some(p) = self.registradas.lock().unwrap().iter().find(|p| p.id == id && p.conta_id == conta_id) {
                return Ok(Some(PartidaGuardada::Registrada { xp_ganho: p.xp_ganho }));
            }
            if self.desistidas.lock().unwrap().iter().any(|(d, _)| *d == id) {
                return Ok(Some(PartidaGuardada::Recusada));
            }
            Ok(self
                .fila
                .lock()
                .unwrap()
                .iter()
                .any(|p| p.partida.id == id && p.partida.conta_id == conta_id)
                .then_some(PartidaGuardada::NaFila))
        }
        async fn ranking(&self, beatmap_id: u64, limite: u32, _conta: Option<Uuid>) -> Result<Vec<LinhaDoRanking>, FalhaExterna> {
            let mut melhores: HashMap<Uuid, PartidaRegistrada> = HashMap::new();
            for p in self.registradas.lock().unwrap().iter().filter(|p| p.beatmap_id == beatmap_id && p.vale_ranking) {
                let melhor = melhores.entry(p.conta_id).or_insert_with(|| p.clone());
                if p.pontuacao > melhor.pontuacao {
                    *melhor = p.clone();
                }
            }
            let mut linhas: Vec<_> = melhores.into_values().collect();
            linhas.sort_by(|a, b| b.pontuacao.cmp(&a.pontuacao).then(a.jogada_em.cmp(&b.jogada_em)));
            Ok(linhas
                .into_iter()
                .take(limite as usize)
                .enumerate()
                .map(|(i, p)| LinhaDoRanking {
                    posicao: i as u32 + 1,
                    partida_id: p.id,
                    conta_id: p.conta_id,
                    nome: "Jogador".into(),
                    avatar: None,
                    pontuacao: p.pontuacao,
                    precisao: p.precisao,
                    maior_combo: p.maior_combo,
                    mods: p.mods,
                    jogada_em: p.jogada_em,
                })
                .collect())
        }
        async fn replay(&self, partida_id: Uuid) -> Result<Option<Vec<u8>>, FalhaExterna> {
            Ok(self
                .registradas
                .lock()
                .unwrap()
                .iter()
                .find(|p| p.id == partida_id)
                .and_then(|p| p.replay.clone()))
        }
        async fn beatmap(&self, beatmap_id: u64) -> Result<Option<BeatmapDoOsu>, FalhaExterna> {
            Ok(self.beatmaps.lock().unwrap().get(&beatmap_id).cloned())
        }
        async fn guardar_beatmap(&self, beatmap: &BeatmapDoOsu) -> Result<(), FalhaExterna> {
            self.beatmaps.lock().unwrap().insert(beatmap.beatmap_id, beatmap.clone());
            Ok(())
        }
        async fn pedir_ao_osu(&self, _agora: DateTime<Utc>) -> Result<bool, FalhaExterna> {
            let mut cabem = self.pedidos_que_cabem.lock().unwrap();
            if *cabem == 0 {
                return Ok(false);
            }
            *cabem -= 1;
            Ok(true)
        }
    }

    /// Responde sempre o mesmo e conta quantas vezes foi chamado.
    pub struct OsuFalso {
        pub resposta: Mutex<Result<BeatmapBaixado, String>>,
        pub chamadas: Mutex<u32>,
    }

    impl OsuFalso {
        pub fn com(resposta: Result<BeatmapBaixado, String>) -> Self {
            Self {
                resposta: Mutex::new(resposta),
                chamadas: Mutex::new(0),
            }
        }
    }

    #[async_trait]
    impl FonteDeBeatmaps for OsuFalso {
        async fn baixar(&self, _beatmap_id: u64) -> Result<BeatmapBaixado, FalhaExterna> {
            *self.chamadas.lock().unwrap() += 1;
            self.resposta.lock().unwrap().clone().map_err(FalhaExterna)
        }
    }

    pub fn servicos(conta: ServicosDaConta, osu: Arc<OsuFalso>) -> (ServicosDoMania, Arc<ManiaEmMemoria>) {
        let repositorio = Arc::new(ManiaEmMemoria::novo());
        let relogio: Arc<dyn Relogio> = conta.relogio.clone();
        (
            ServicosDoMania {
                repositorio: repositorio.clone(),
                fonte: osu,
                conta,
                relogio,
                gerador: Arc::new(GeradorEmSequencia::default()),
            },
            repositorio,
        )
    }

    /// Para quem só precisa montar o estado do app.
    pub fn servicos_vazios(conta: ServicosDaConta) -> ServicosDoMania {
        servicos(conta, Arc::new(OsuFalso::com(Err("sem osu! nos testes".into())))).0
    }

    pub fn relogio() -> Arc<RelogioFalso> {
        Arc::new(RelogioFalso::novo())
    }
}

#[cfg(test)]
mod tests {
    use riffrush_motor_mania as motor;

    use super::fakes::{servicos, OsuFalso};
    use super::*;
    use crate::modules::conta::fakes::{pedido, servicos as servicos_da_conta, RelogioFalso};
    use crate::modules::mania::dominio::tests::{mapa, replay_perfeito};

    const BEATMAP: u64 = 42;

    fn beatmap(status: &str, texto: &str) -> BeatmapDoOsu {
        BeatmapDoOsu {
            beatmap_id: BEATMAP,
            beatmapset_id: Some(7),
            md5: motor::hash_do_beatmap(texto.as_bytes()),
            status: status.into(),
            estrelas: 4.0,
            texto: texto.into(),
        }
    }

    struct Cenario {
        servicos: ServicosDoMania,
        repositorio: Arc<super::fakes::ManiaEmMemoria>,
        osu: Arc<OsuFalso>,
        relogio: Arc<RelogioFalso>,
        token: String,
        texto: String,
    }

    async fn cenario(status: &str) -> Cenario {
        let (conta, _, relogio) = servicos_da_conta();
        let token = conta.entrar_com_google(&pedido("bom")).await.unwrap().token;
        let texto = mapa(400);
        let osu = Arc::new(OsuFalso::com(Ok(BeatmapBaixado::Pronto(beatmap(status, &texto)))));
        let (servicos, repositorio) = servicos(conta, osu.clone());
        Cenario {
            servicos,
            repositorio,
            osu,
            relogio,
            token,
            texto,
        }
    }

    #[tokio::test]
    async fn partida_em_mapa_ranked_rende_xp_entra_no_ranking_e_o_mapa_fica_guardado() {
        let c = cenario("ranked").await;
        let replay = replay_perfeito(&c.texto, 400, motor::Mods::NENHUM);
        let id = c.servicos.enviar_partida(&c.token, BEATMAP, replay.clone()).await.unwrap();
        assert_eq!(c.servicos.situacao(&c.token, id).await.unwrap(), Situacao::NaFila);
        assert_eq!(c.servicos.processar_lote().await.unwrap(), [Desfecho::Registrada]);
        let registrada = c.repositorio.registradas.lock().unwrap()[0].clone();
        assert_eq!(
            (registrada.pontuacao, registrada.vale_ranking, registrada.beatmapset_id),
            (1_000_000, true, Some(7))
        );
        assert!(registrada.xp_ganho > 0);
        assert_eq!(registrada.replay, Some(replay));
        assert!(matches!(c.servicos.situacao(&c.token, id).await.unwrap(), Situacao::Registrada { xp_ganho, .. } if xp_ganho == registrada.xp_ganho));
        assert_eq!(c.servicos.ranking(BEATMAP, None).await.unwrap().len(), 1);
        assert!(c.repositorio.beatmaps.lock().unwrap().contains_key(&BEATMAP));
    }

    #[tokio::test]
    async fn o_segundo_envio_no_mesmo_mapa_usa_o_cache_e_repetir_rende_menos() {
        let c = cenario("loved").await;
        let replay = replay_perfeito(&c.texto, 400, motor::Mods::NENHUM);
        for _ in 0..3 {
            c.servicos.enviar_partida(&c.token, BEATMAP, replay.clone()).await.unwrap();
            c.servicos.processar_lote().await.unwrap();
            c.relogio.andar(Duration::minutes(5));
        }
        assert_eq!(*c.osu.chamadas.lock().unwrap(), 1);
        let xp: Vec<u64> = c.repositorio.registradas.lock().unwrap().iter().map(|p| p.xp_ganho).collect();
        assert!(xp[2] < xp[0]);
    }

    #[tokio::test]
    async fn mapa_graveyard_nao_rende_xp_nem_ranking_e_nao_fica_guardado() {
        let c = cenario("graveyard").await;
        c.servicos
            .enviar_partida(&c.token, BEATMAP, replay_perfeito(&c.texto, 400, motor::Mods::NENHUM))
            .await
            .unwrap();
        c.servicos.processar_lote().await.unwrap();
        let registrada = c.repositorio.registradas.lock().unwrap()[0].clone();
        assert_eq!((registrada.xp_ganho, registrada.vale_ranking, registrada.replay), (0, false, None));
        assert!(c.repositorio.beatmaps.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn replay_de_outro_mapa_e_recusado() {
        let c = cenario("ranked").await;
        let outro = mapa(300);
        let id = c
            .servicos
            .enviar_partida(&c.token, BEATMAP, replay_perfeito(&outro, 300, motor::Mods::NENHUM))
            .await
            .unwrap();
        assert_eq!(
            c.servicos.processar_lote().await.unwrap(),
            [Desfecho::Desistida("o replay é de outro mapa".into())]
        );
        assert_eq!(c.servicos.situacao(&c.token, id).await.unwrap(), Situacao::Recusada);
    }

    #[tokio::test]
    async fn osu_fora_do_ar_ou_limite_cheio_reagenda_sem_perder_a_partida() {
        let c = cenario("ranked").await;
        *c.osu.resposta.lock().unwrap() = Err("osu! fora".into());
        c.servicos
            .enviar_partida(&c.token, BEATMAP, replay_perfeito(&c.texto, 400, motor::Mods::NENHUM))
            .await
            .unwrap();
        assert_eq!(c.servicos.processar_lote().await.unwrap(), [Desfecho::Reagendada]);

        *c.repositorio.pedidos_que_cabem.lock().unwrap() = 0;
        c.relogio.andar(Duration::minutes(1));
        c.servicos
            .enviar_partida(&c.token, BEATMAP, replay_perfeito(&c.texto, 400, motor::Mods::NENHUM))
            .await
            .unwrap();
        assert_eq!(c.servicos.processar_lote().await.unwrap(), [Desfecho::Reagendada]);
        assert_eq!(*c.osu.chamadas.lock().unwrap(), 1);
    }

    #[tokio::test]
    async fn mapa_que_nao_existe_ou_nao_e_mania_e_recusado() {
        let c = cenario("ranked").await;
        *c.osu.resposta.lock().unwrap() = Ok(BeatmapBaixado::NaoEhMania);
        c.servicos
            .enviar_partida(&c.token, BEATMAP, replay_perfeito(&c.texto, 400, motor::Mods::NENHUM))
            .await
            .unwrap();
        assert_eq!(
            c.servicos.processar_lote().await.unwrap(),
            [Desfecho::Desistida("o mapa não é do modo mania".into())]
        );
    }

    #[tokio::test]
    async fn random_joga_e_rende_xp_mas_fica_fora_do_ranking() {
        let c = cenario("ranked").await;
        c.servicos
            .enviar_partida(&c.token, BEATMAP, replay_perfeito(&c.texto, 400, motor::Mods::RANDOM))
            .await
            .unwrap();
        c.servicos.processar_lote().await.unwrap();
        let registrada = c.repositorio.registradas.lock().unwrap()[0].clone();
        assert!(!registrada.vale_ranking);
    }

    #[tokio::test]
    async fn envio_recusa_sessao_replay_quebrado_mapa_zero_e_pressa() {
        let c = cenario("ranked").await;
        let replay = replay_perfeito(&c.texto, 400, motor::Mods::NENHUM);
        assert!(matches!(
            c.servicos.enviar_partida("token-ruim", BEATMAP, replay.clone()).await,
            Err(ErroDoMania::Conta(_))
        ));
        assert!(matches!(
            c.servicos.enviar_partida(&c.token, BEATMAP, vec![9, 9]).await,
            Err(ErroDoMania::ReplayInvalido)
        ));
        assert!(matches!(
            c.servicos.enviar_partida(&c.token, 0, replay.clone()).await,
            Err(ErroDoMania::MapaInvalido)
        ));
        c.servicos.enviar_partida(&c.token, BEATMAP, replay.clone()).await.unwrap();
        assert!(matches!(
            c.servicos.enviar_partida(&c.token, BEATMAP, replay).await,
            Err(ErroDoMania::RapidoDemais)
        ));
    }
}
