use std::sync::Arc;

use uuid::Uuid;

use super::dominio::{hash_do_token, pode_registrar, Conta, DURACAO_DA_SESSAO, TAMANHO_MAXIMO_DO_ID_DA_MUSICA};
use super::portas::{
    ErroDeLogin, FalhaExterna, FilaDePartidas, Gerador, PartidaNaFila, PartidaRegistrada, PedidoDeLogin, ProvedorDeLogin, Relogio, RepositorioDeContas,
    RepositorioDeSessoes,
};
use crate::modules::catalogo::{origem_do_id, Origem};
use crate::modules::progresso::{nivel_do_xp, validar_replay, xp_da_partida, Instrumento, Nivel, PartidaInvalida, ResumoDaPartida};

/// As portas que os casos de uso da conta usam. O main liga os adaptadores reais; os testes, fakes.
#[derive(Clone)]
pub struct ServicosDaConta {
    pub contas: Arc<dyn RepositorioDeContas>,
    pub sessoes: Arc<dyn RepositorioDeSessoes>,
    pub login: Arc<dyn ProvedorDeLogin>,
    pub relogio: Arc<dyn Relogio>,
    pub gerador: Arc<dyn Gerador>,
    /// Onde esperam as partidas do Encore até o servidor rejulgar o replay.
    pub fila: Arc<dyn FilaDePartidas>,
}

#[derive(Debug, thiserror::Error)]
pub enum ErroDaConta {
    #[error("sessão inválida ou expirada")]
    SessaoInvalida,
    #[error("o Google recusou o login")]
    LoginRecusado,
    #[error(transparent)]
    PartidaInvalida(#[from] PartidaInvalida),
    #[error("o id da música é grande demais")]
    MusicaInvalida,
    #[error("partidas rápidas demais")]
    RapidoDemais,
    #[error("partida de música do Encore precisa do replay")]
    ReplayObrigatorio,
    #[error(transparent)]
    Falha(#[from] FalhaExterna),
}

impl From<ErroDeLogin> for ErroDaConta {
    fn from(erro: ErroDeLogin) -> Self {
        match erro {
            ErroDeLogin::Recusado => Self::LoginRecusado,
            ErroDeLogin::Falha(falha) => Self::Falha(falha),
        }
    }
}

pub struct Entrada {
    pub token: String,
    pub conta: Conta,
}

pub struct PartidaEnviada {
    pub musica_id: String,
    pub instrumento: Instrumento,
    pub pontos: u64,
    pub resumo: ResumoDaPartida,
    /// As entradas da partida, comprimidas pelo app.
    pub replay: Option<Vec<u8>>,
}

/// O que acontece com a partida enviada.
#[derive(Debug, PartialEq, Eq)]
pub enum Registro {
    /// O XP já está na conta.
    Registrada(XpDaPartida),
    /// Música do Encore: o XP entra quando o servidor terminar de rejulgar o replay.
    NaFila { id: Uuid },
}

/// Uma partida que o servidor rejulgou: os números vêm do replay, não do app.
pub struct PartidaRejulgada {
    pub id: Uuid,
    pub conta_id: Uuid,
    pub musica_id: String,
    pub instrumento: Instrumento,
    pub pontos: u64,
    pub resumo: ResumoDaPartida,
    /// De 0 a 1, pelo valor de cada nota.
    pub precisao: f64,
    /// Com o modificador sem falha a partida rende XP, mas fica fora do ranking.
    pub sem_falha: bool,
    pub jogada_em: chrono::DateTime<chrono::Utc>,
    pub replay: Vec<u8>,
}

/// O XP cai para quem repete o mesmo chart dentro deste tempo.
const JANELA_DAS_REPETICOES: chrono::Duration = chrono::Duration::hours(24);

#[derive(Debug, PartialEq, Eq)]
pub struct XpDaPartida {
    pub xp_ganho: u64,
    pub antes: Nivel,
    pub depois: Nivel,
}

impl ServicosDaConta {
    pub async fn entrar_com_google(&self, pedido: &PedidoDeLogin) -> Result<Entrada, ErroDaConta> {
        let perfil = self.login.trocar_codigo(pedido).await?;
        let conta = self.contas.entrar(&perfil, self.gerador.id()).await?;
        let token = self.gerador.token();
        let expira_em = self.relogio.agora() + DURACAO_DA_SESSAO;
        self.sessoes.criar(&hash_do_token(&token), conta.id, expira_em).await?;
        Ok(Entrada { token, conta })
    }

    pub async fn conta_da_sessao(&self, token: &str) -> Result<Conta, ErroDaConta> {
        let conta_id = self.id_da_sessao(token).await?;
        self.contas.buscar(conta_id).await?.ok_or(ErroDaConta::SessaoInvalida)
    }

    pub async fn sair(&self, token: &str) -> Result<(), ErroDaConta> {
        Ok(self.sessoes.apagar(&hash_do_token(token)).await?)
    }

    pub async fn registrar_partida(&self, token: &str, partida: PartidaEnviada) -> Result<Registro, ErroDaConta> {
        let conta = self.conta_da_sessao(token).await?;
        let resumo = partida.resumo.validar()?;
        if partida.musica_id.is_empty() || partida.musica_id.len() > TAMANHO_MAXIMO_DO_ID_DA_MUSICA {
            return Err(ErroDaConta::MusicaInvalida);
        }
        let agora = self.relogio.agora();
        if !pode_registrar(self.contas.ultima_partida(conta.id).await?, agora) {
            return Err(ErroDaConta::RapidoDemais);
        }
        if let Origem::Encore(md5) = origem_do_id(&partida.musica_id) {
            match partida.replay {
                Some(replay) => {
                    validar_replay(&replay)?;
                    let id = self.gerador.id();
                    self.fila
                        .enfileirar(PartidaNaFila {
                            id,
                            conta_id: conta.id,
                            md5,
                            dificuldade: resumo.dificuldade,
                            instrumento: partida.instrumento,
                            replay,
                            enviada_em: agora,
                        })
                        .await?;
                    return Ok(Registro::NaFila { id });
                }
                // O app só deixa de mandar o replay quando o jogador desiste no meio: fica no histórico, sem XP.
                None if !resumo.derrota => return Err(ErroDaConta::ReplayObrigatorio),
                None => {}
            }
        }
        // Sem um chart que o servidor consiga conferir (importada, do jogo, desistência), a partida fica só no
        // histórico: sem XP e fora do ranking, porque os números vêm do app.
        let xp_ganho = 0;
        let atualizada = self
            .contas
            .registrar_partida(&PartidaRegistrada {
                id: self.gerador.id(),
                conta_id: conta.id,
                musica_id: partida.musica_id,
                instrumento: partida.instrumento,
                pontos: partida.pontos,
                resumo,
                xp_ganho,
                jogada_em: agora,
                replay: None,
                precisao: None,
            })
            .await?;
        Ok(Registro::Registrada(XpDaPartida {
            xp_ganho,
            antes: conta.nivel(),
            depois: nivel_do_xp(atualizada.xp_total),
        }))
    }

    /// Registra a partida que saiu da fila, com o XP calculado sobre o rejulgamento.
    pub async fn registrar_partida_rejulgada(&self, partida: PartidaRejulgada) -> Result<(), ErroDaConta> {
        let resumo = partida.resumo.validar()?;
        let vale_para_o_ranking = !resumo.derrota && !resumo.fantasma && !partida.sem_falha;
        let repeticoes = self
            .contas
            .partidas_no_chart(partida.conta_id, &partida.musica_id, partida.jogada_em - JANELA_DAS_REPETICOES, partida.id)
            .await?;
        self.contas
            .registrar_partida(&PartidaRegistrada {
                id: partida.id,
                conta_id: partida.conta_id,
                musica_id: partida.musica_id,
                instrumento: partida.instrumento,
                pontos: partida.pontos,
                resumo,
                xp_ganho: xp_da_partida(resumo, partida.precisao, repeticoes),
                jogada_em: partida.jogada_em,
                replay: vale_para_o_ranking.then_some(partida.replay),
                // O ranking só lê partidas com precisão: sem ela, a partida fica de fora.
                precisao: vale_para_o_ranking.then_some(partida.precisao),
            })
            .await?;
        Ok(())
    }

    /// A pessoa pede para apagar tudo o que a API guarda dela (LGPD).
    pub async fn excluir_conta(&self, token: &str) -> Result<(), ErroDaConta> {
        let conta_id = self.id_da_sessao(token).await?;
        Ok(self.contas.excluir(conta_id).await?)
    }

    async fn id_da_sessao(&self, token: &str) -> Result<Uuid, ErroDaConta> {
        self.sessoes
            .conta_da_sessao(&hash_do_token(token), self.relogio.agora())
            .await?
            .ok_or(ErroDaConta::SessaoInvalida)
    }
}

/// Fakes das portas, para os testes daqui e os de integração (feature `testes`).
#[cfg(any(test, feature = "testes"))]
pub mod fakes {
    use std::collections::HashMap;
    use std::sync::Mutex;

    use async_trait::async_trait;
    use chrono::{DateTime, Duration, TimeZone, Utc};

    use super::*;
    use crate::modules::conta::dominio::PerfilDoGoogle;
    use crate::modules::conta::portas::ClienteDoGoogle;

    /// (conta, música, quando, id).
    pub type PartidaNoChart = (Uuid, String, DateTime<Utc>, Uuid);

    #[derive(Default)]
    pub struct Banco {
        pub contas: Mutex<HashMap<Uuid, (String, Conta)>>,
        pub sessoes: Mutex<HashMap<String, (Uuid, DateTime<Utc>)>>,
        pub partidas: Mutex<Vec<(Uuid, DateTime<Utc>, u64)>>,
        /// O replay da última partida registrada.
        pub ultimo_replay: Mutex<Option<Vec<u8>>>,
        pub ids_das_partidas: Mutex<Vec<Uuid>>,
        /// Cada partida registrada, para contar as repetições.
        pub por_chart: Mutex<Vec<PartidaNoChart>>,
        /// A precisão da última partida registrada.
        pub ultima_precisao: Mutex<Option<f64>>,
    }

    /// Guarda o que entrou na fila, para o teste conferir.
    #[derive(Default)]
    pub struct FilaEmMemoria(pub Mutex<Vec<PartidaNaFila>>);

    #[async_trait]
    impl FilaDePartidas for FilaEmMemoria {
        async fn enfileirar(&self, partida: PartidaNaFila) -> Result<(), FalhaExterna> {
            self.0.lock().unwrap().push(partida);
            Ok(())
        }
    }

    #[async_trait]
    impl RepositorioDeContas for Banco {
        async fn entrar(&self, perfil: &PerfilDoGoogle, novo_id: Uuid) -> Result<Conta, FalhaExterna> {
            let mut contas = self.contas.lock().unwrap();
            let existente = contas.values_mut().find(|(sub, _)| *sub == perfil.sub);
            let conta = match existente {
                Some((_, conta)) => {
                    conta.nome = perfil.nome.clone();
                    if perfil.email.is_some() {
                        conta.email = perfil.email.clone();
                    }
                    conta.clone()
                }
                None => {
                    let conta = Conta {
                        id: novo_id,
                        nome: perfil.nome.clone(),
                        avatar: perfil.avatar.clone(),
                        email: perfil.email.clone(),
                        xp_total: 0,
                    };
                    contas.insert(novo_id, (perfil.sub.clone(), conta.clone()));
                    conta
                }
            };
            Ok(conta)
        }
        async fn buscar(&self, id: Uuid) -> Result<Option<Conta>, FalhaExterna> {
            Ok(self.contas.lock().unwrap().get(&id).map(|(_, c)| c.clone()))
        }
        async fn ultima_partida(&self, conta_id: Uuid) -> Result<Option<DateTime<Utc>>, FalhaExterna> {
            Ok(self
                .partidas
                .lock()
                .unwrap()
                .iter()
                .filter(|(c, _, _)| *c == conta_id)
                .map(|(_, quando, _)| *quando)
                .max())
        }
        async fn registrar_partida(&self, partida: &PartidaRegistrada) -> Result<Conta, FalhaExterna> {
            if self.ids_das_partidas.lock().unwrap().contains(&partida.id) {
                return self.buscar(partida.conta_id).await?.ok_or_else(|| FalhaExterna("sem conta".into()));
            }
            self.ids_das_partidas.lock().unwrap().push(partida.id);
            self.por_chart
                .lock()
                .unwrap()
                .push((partida.conta_id, partida.musica_id.clone(), partida.jogada_em, partida.id));
            *self.ultima_precisao.lock().unwrap() = partida.precisao;
            self.partidas.lock().unwrap().push((partida.conta_id, partida.jogada_em, partida.xp_ganho));
            *self.ultimo_replay.lock().unwrap() = partida.replay.clone();
            let mut contas = self.contas.lock().unwrap();
            let (_, conta) = contas.get_mut(&partida.conta_id).ok_or_else(|| FalhaExterna("sem conta".into()))?;
            conta.xp_total += partida.xp_ganho;
            Ok(conta.clone())
        }
        async fn partidas_no_chart(&self, conta_id: Uuid, musica_id: &str, desde: DateTime<Utc>, exceto: Uuid) -> Result<u32, FalhaExterna> {
            let quantas = self
                .por_chart
                .lock()
                .unwrap()
                .iter()
                .filter(|(c, m, quando, id)| *c == conta_id && m == musica_id && *quando >= desde && *id != exceto)
                .count();
            Ok(u32::try_from(quantas).unwrap_or(u32::MAX))
        }
        async fn excluir(&self, id: Uuid) -> Result<(), FalhaExterna> {
            self.contas.lock().unwrap().remove(&id);
            self.sessoes.lock().unwrap().retain(|_, (conta, _)| *conta != id);
            self.partidas.lock().unwrap().retain(|(conta, _, _)| *conta != id);
            Ok(())
        }
    }

    #[async_trait]
    impl RepositorioDeSessoes for Banco {
        async fn criar(&self, token_hash: &str, conta_id: Uuid, expira_em: DateTime<Utc>) -> Result<(), FalhaExterna> {
            self.sessoes.lock().unwrap().insert(token_hash.into(), (conta_id, expira_em));
            Ok(())
        }
        async fn conta_da_sessao(&self, token_hash: &str, agora: DateTime<Utc>) -> Result<Option<Uuid>, FalhaExterna> {
            Ok(self
                .sessoes
                .lock()
                .unwrap()
                .get(token_hash)
                .filter(|(_, expira)| *expira > agora)
                .map(|(id, _)| *id))
        }
        async fn apagar(&self, token_hash: &str) -> Result<(), FalhaExterna> {
            self.sessoes.lock().unwrap().remove(token_hash);
            Ok(())
        }
    }

    /// Aceita o código "bom" e recusa qualquer outro.
    pub struct GoogleFalso;

    #[async_trait]
    impl ProvedorDeLogin for GoogleFalso {
        async fn trocar_codigo(&self, pedido: &PedidoDeLogin) -> Result<PerfilDoGoogle, ErroDeLogin> {
            match pedido.codigo.as_str() {
                "bom" => Ok(PerfilDoGoogle {
                    sub: "google-1".into(),
                    nome: "Lucas".into(),
                    avatar: None,
                    email: Some("lucas@exemplo.com".into()),
                }),
                _ => Err(ErroDeLogin::Recusado),
            }
        }
    }

    pub struct RelogioFalso(pub Mutex<DateTime<Utc>>);

    impl RelogioFalso {
        pub fn novo() -> Self {
            Self(Mutex::new(Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap()))
        }
        pub fn andar(&self, quanto: Duration) {
            *self.0.lock().unwrap() += quanto;
        }
    }

    impl Relogio for RelogioFalso {
        fn agora(&self) -> DateTime<Utc> {
            *self.0.lock().unwrap()
        }
    }

    #[derive(Default)]
    pub struct GeradorEmSequencia(Mutex<u128>);

    impl Gerador for GeradorEmSequencia {
        fn id(&self) -> Uuid {
            let mut n = self.0.lock().unwrap();
            *n += 1;
            Uuid::from_u128(*n)
        }
        fn token(&self) -> String {
            format!("token-{}", self.id())
        }
    }

    pub fn servicos() -> (ServicosDaConta, Arc<Banco>, Arc<RelogioFalso>) {
        let (servicos, banco, relogio, _) = servicos_com_fila();
        (servicos, banco, relogio)
    }

    pub fn servicos_com_fila() -> (ServicosDaConta, Arc<Banco>, Arc<RelogioFalso>, Arc<FilaEmMemoria>) {
        let banco = Arc::new(Banco::default());
        let fila = Arc::new(FilaEmMemoria::default());
        let relogio = Arc::new(RelogioFalso::novo());
        let servicos = ServicosDaConta {
            contas: banco.clone(),
            sessoes: banco.clone(),
            login: Arc::new(GoogleFalso),
            relogio: relogio.clone(),
            gerador: Arc::new(GeradorEmSequencia::default()),
            fila: fila.clone(),
        };
        (servicos, banco, relogio, fila)
    }

    pub fn pedido(codigo: &str) -> PedidoDeLogin {
        PedidoDeLogin {
            codigo: codigo.into(),
            verificador: "v".into(),
            redirect_uri: "http://localhost".into(),
            cliente: ClienteDoGoogle::Web,
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::Duration;

    use super::fakes::{pedido, servicos};
    use super::*;
    use crate::modules::progresso::Dificuldade;

    fn partida(acertos: u32, total: u32) -> PartidaEnviada {
        PartidaEnviada {
            musica_id: "embutida:neon".into(),
            instrumento: Instrumento::Guitarra,
            pontos: 1000,
            resumo: ResumoDaPartida {
                dificuldade: Dificuldade::Medio,
                acertos,
                total,
                derrota: false,
                fantasma: false,
                maior_sequencia: None,
                valor_dos_acertos: None,
            },
            replay: None,
        }
    }

    #[tokio::test]
    async fn entrar_cria_a_conta_e_uma_sessao() {
        let (servicos, banco, _) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        assert_eq!(entrada.conta.nome, "Lucas");
        assert_eq!(servicos.conta_da_sessao(&entrada.token).await.unwrap(), entrada.conta);
        // O banco nunca guarda o token em si.
        assert!(!banco.sessoes.lock().unwrap().contains_key(&entrada.token));
    }

    #[tokio::test]
    async fn entrar_de_novo_usa_a_mesma_conta() {
        let (servicos, _, _) = servicos();
        let primeira = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        let segunda = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        assert_eq!(primeira.conta.id, segunda.conta.id);
        assert_ne!(primeira.token, segunda.token);
    }

    #[tokio::test]
    async fn codigo_recusado_nao_entra() {
        let (servicos, _, _) = servicos();
        assert!(matches!(servicos.entrar_com_google(&pedido("ruim")).await, Err(ErroDaConta::LoginRecusado)));
    }

    #[tokio::test]
    async fn sessao_expira_e_sair_derruba_a_sessao() {
        let (servicos, _, relogio) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        servicos.sair(&entrada.token).await.unwrap();
        assert!(matches!(servicos.conta_da_sessao(&entrada.token).await, Err(ErroDaConta::SessaoInvalida)));

        let outra = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        relogio.andar(DURACAO_DA_SESSAO + Duration::seconds(1));
        assert!(matches!(servicos.conta_da_sessao(&outra.token).await, Err(ErroDaConta::SessaoInvalida)));
    }

    #[tokio::test]
    async fn partida_sem_chart_que_o_servidor_confira_fica_no_historico_sem_xp() {
        let (servicos, banco, _) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        let importada = PartidaEnviada {
            replay: Some(vec![2, 0]),
            ..partida(400, 400)
        };
        let Registro::Registrada(xp) = servicos.registrar_partida(&entrada.token, importada).await.unwrap() else {
            panic!("a partida devia ser registrada na hora");
        };
        assert_eq!(xp.xp_ganho, 0);
        assert_eq!(banco.partidas.lock().unwrap().len(), 1);
        assert_eq!(*banco.ultimo_replay.lock().unwrap(), None);
        assert_eq!(*banco.ultima_precisao.lock().unwrap(), None);
    }

    fn rejulgada(id: u128, conta_id: Uuid, quando: chrono::DateTime<chrono::Utc>) -> PartidaRejulgada {
        let mut resumo = partida(400, 400).resumo;
        resumo.dificuldade = Dificuldade::Expert;
        PartidaRejulgada {
            id: Uuid::from_u128(id),
            conta_id,
            musica_id: format!("encore:{MD5}"),
            instrumento: Instrumento::Guitarra,
            pontos: 500,
            resumo,
            precisao: 1.0,
            sem_falha: false,
            jogada_em: quando,
            replay: vec![2, 0],
        }
    }

    #[tokio::test]
    async fn partida_rejulgada_da_xp_pela_precisao_e_pode_subir_de_nivel() {
        let (servicos, banco, relogio) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        // Um expert perfeito de tamanho comum passa dos 100 XP do nível 1.
        servicos
            .registrar_partida_rejulgada(rejulgada(1, entrada.conta.id, relogio.agora()))
            .await
            .unwrap();
        let conta = servicos.conta_da_sessao(&entrada.token).await.unwrap();
        assert_eq!((conta.xp_total, conta.nivel().nivel), (108, 2));
        assert_eq!(*banco.ultima_precisao.lock().unwrap(), Some(1.0));
    }

    #[tokio::test]
    async fn repetir_o_chart_no_dia_rende_menos_e_no_dia_seguinte_volta() {
        let (servicos, banco, relogio) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        let xps = |banco: &super::fakes::Banco| banco.partidas.lock().unwrap().iter().map(|(_, _, xp)| *xp).collect::<Vec<_>>();
        for id in 1..=3 {
            relogio.andar(Duration::minutes(5));
            servicos
                .registrar_partida_rejulgada(rejulgada(id, entrada.conta.id, relogio.agora()))
                .await
                .unwrap();
        }
        assert_eq!(xps(&banco), [108, 108, 76]);
        relogio.andar(Duration::hours(25));
        servicos
            .registrar_partida_rejulgada(rejulgada(4, entrada.conta.id, relogio.agora()))
            .await
            .unwrap();
        assert_eq!(xps(&banco)[3], 108);
    }

    #[tokio::test]
    async fn partida_sem_sessao_e_recusada() {
        let (servicos, _, _) = servicos();
        assert!(matches!(
            servicos.registrar_partida("inventado", partida(1, 1)).await,
            Err(ErroDaConta::SessaoInvalida)
        ));
    }

    #[tokio::test]
    async fn partida_impossivel_e_recusada() {
        let (servicos, banco, _) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        assert!(matches!(
            servicos.registrar_partida(&entrada.token, partida(5, 1)).await,
            Err(ErroDaConta::PartidaInvalida(_))
        ));
        let sem_musica = PartidaEnviada {
            musica_id: String::new(),
            ..partida(1, 1)
        };
        assert!(matches!(
            servicos.registrar_partida(&entrada.token, sem_musica).await,
            Err(ErroDaConta::MusicaInvalida)
        ));
        assert!(banco.partidas.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn partidas_em_sequencia_rapida_sao_recusadas() {
        let (servicos, _, relogio) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        servicos.registrar_partida(&entrada.token, partida(10, 10)).await.unwrap();
        assert!(matches!(
            servicos.registrar_partida(&entrada.token, partida(10, 10)).await,
            Err(ErroDaConta::RapidoDemais)
        ));
        relogio.andar(Duration::seconds(30));
        assert!(servicos.registrar_partida(&entrada.token, partida(10, 10)).await.is_ok());
    }

    #[tokio::test]
    async fn excluir_apaga_a_conta_as_sessoes_e_as_partidas() {
        let (servicos, banco, _) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        let outra_sessao = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        servicos.registrar_partida(&entrada.token, partida(10, 10)).await.unwrap();

        servicos.excluir_conta(&entrada.token).await.unwrap();

        assert!(banco.contas.lock().unwrap().is_empty());
        assert!(banco.partidas.lock().unwrap().is_empty());
        assert!(matches!(servicos.conta_da_sessao(&outra_sessao.token).await, Err(ErroDaConta::SessaoInvalida)));
        // Entrar de novo começa uma conta zerada.
        let nova = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        assert_eq!(nova.conta.xp_total, 0);
    }

    #[tokio::test]
    async fn excluir_sem_sessao_e_recusado() {
        let (servicos, _, _) = servicos();
        assert!(matches!(servicos.excluir_conta("inventado").await, Err(ErroDaConta::SessaoInvalida)));
    }

    #[tokio::test]
    async fn partida_sem_falha_rende_xp_mas_fica_fora_do_ranking() {
        let (servicos, banco, relogio) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        let sem_falha = PartidaRejulgada {
            sem_falha: true,
            ..rejulgada(1, entrada.conta.id, relogio.agora())
        };
        servicos.registrar_partida_rejulgada(sem_falha).await.unwrap();
        assert_eq!(servicos.conta_da_sessao(&entrada.token).await.unwrap().xp_total, 108);
        assert_eq!(*banco.ultimo_replay.lock().unwrap(), None);
        assert_eq!(*banco.ultima_precisao.lock().unwrap(), None);
    }

    #[tokio::test]
    async fn partida_rejulgada_com_vaia_fica_sem_replay() {
        let (servicos, banco, relogio) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        let mut vaiada = rejulgada(1, entrada.conta.id, relogio.agora());
        vaiada.resumo.derrota = true;
        servicos.registrar_partida_rejulgada(vaiada).await.unwrap();
        assert_eq!(*banco.ultimo_replay.lock().unwrap(), None);
    }

    #[tokio::test]
    async fn replay_de_versao_desconhecida_e_recusado() {
        let (servicos, _, _) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        let estranho = PartidaEnviada {
            musica_id: format!("encore:{MD5}"),
            replay: Some(vec![42, 0]),
            ..partida(1, 1)
        };
        assert!(matches!(
            servicos.registrar_partida(&entrada.token, estranho).await,
            Err(ErroDaConta::PartidaInvalida(PartidaInvalida::ReplayInvalido))
        ));
    }

    const MD5: &str = "fb0079d4c2e025d5b8dd70724750a923";

    #[tokio::test]
    async fn partida_do_encore_vai_para_a_fila_sem_xp_na_hora() {
        let (servicos, banco, _, fila) = super::fakes::servicos_com_fila();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        let do_encore = PartidaEnviada {
            musica_id: format!("encore:{}", MD5.to_uppercase()),
            replay: Some(vec![2, 0]),
            ..partida(10, 10)
        };
        let registro = servicos.registrar_partida(&entrada.token, do_encore).await.unwrap();
        let na_fila = fila.0.lock().unwrap();
        assert_eq!(registro, Registro::NaFila { id: na_fila[0].id });
        assert_eq!((na_fila[0].md5.as_str(), na_fila[0].replay.as_slice()), (MD5, [2, 0].as_slice()));
        assert!(banco.partidas.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn partida_do_encore_sem_replay_so_vale_como_desistencia() {
        let (servicos, _, relogio) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        let sem_replay = PartidaEnviada {
            musica_id: format!("encore:{MD5}"),
            ..partida(10, 10)
        };
        assert!(matches!(
            servicos.registrar_partida(&entrada.token, sem_replay).await,
            Err(ErroDaConta::ReplayObrigatorio)
        ));
        relogio.andar(Duration::minutes(1));
        let mut desistiu = PartidaEnviada {
            musica_id: format!("encore:{MD5}"),
            ..partida(3, 10)
        };
        desistiu.resumo.derrota = true;
        assert!(matches!(
            servicos.registrar_partida(&entrada.token, desistiu).await,
            Ok(Registro::Registrada(_))
        ));
    }

    #[tokio::test]
    async fn partida_rejulgada_registra_uma_vez_so_mesmo_entregue_duas() {
        let (servicos, banco, relogio) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        servicos
            .registrar_partida_rejulgada(rejulgada(77, entrada.conta.id, relogio.agora()))
            .await
            .unwrap();
        servicos
            .registrar_partida_rejulgada(rejulgada(77, entrada.conta.id, relogio.agora()))
            .await
            .unwrap();
        assert_eq!(banco.partidas.lock().unwrap().len(), 1);
        assert_eq!(*banco.ultimo_replay.lock().unwrap(), Some(vec![2, 0]));
    }
}
