use std::sync::Arc;

use uuid::Uuid;

use super::dominio::{hash_do_token, pode_registrar, Conta, DURACAO_DA_SESSAO, TAMANHO_MAXIMO_DO_ID_DA_MUSICA};
use super::portas::{
    ErroDeLogin, FalhaExterna, Gerador, PartidaRegistrada, PedidoDeLogin, ProvedorDeLogin, Relogio, RepositorioDeContas, RepositorioDeSessoes,
};
use crate::modules::progresso::{nivel_do_xp, validar_replay, xp_da_partida, Instrumento, Nivel, PartidaInvalida, ResumoDaPartida};

/// As portas que os casos de uso da conta usam. O main liga os adaptadores reais; os testes, fakes.
#[derive(Clone)]
pub struct ServicosDaConta {
    pub contas: Arc<dyn RepositorioDeContas>,
    pub sessoes: Arc<dyn RepositorioDeSessoes>,
    pub login: Arc<dyn ProvedorDeLogin>,
    pub relogio: Arc<dyn Relogio>,
    pub gerador: Arc<dyn Gerador>,
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

    pub async fn registrar_partida(&self, token: &str, partida: PartidaEnviada) -> Result<XpDaPartida, ErroDaConta> {
        let conta = self.conta_da_sessao(token).await?;
        let resumo = partida.resumo.validar()?;
        if partida.musica_id.is_empty() || partida.musica_id.len() > TAMANHO_MAXIMO_DO_ID_DA_MUSICA {
            return Err(ErroDaConta::MusicaInvalida);
        }
        let agora = self.relogio.agora();
        if !pode_registrar(self.contas.ultima_partida(conta.id).await?, agora) {
            return Err(ErroDaConta::RapidoDemais);
        }
        // Derrota e fantasma não entram no ranking: o replay delas não teria quem assistir.
        let replay = match partida.replay {
            Some(bytes) if !resumo.derrota && !resumo.fantasma => {
                validar_replay(&bytes)?;
                Some(bytes)
            }
            _ => None,
        };
        let xp_ganho = xp_da_partida(resumo);
        let atualizada = self
            .contas
            .registrar_partida(&PartidaRegistrada {
                conta_id: conta.id,
                musica_id: partida.musica_id,
                instrumento: partida.instrumento,
                pontos: partida.pontos,
                resumo,
                xp_ganho,
                jogada_em: agora,
                replay,
            })
            .await?;
        Ok(XpDaPartida {
            xp_ganho,
            antes: conta.nivel(),
            depois: nivel_do_xp(atualizada.xp_total),
        })
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

    #[derive(Default)]
    pub struct Banco {
        pub contas: Mutex<HashMap<Uuid, (String, Conta)>>,
        pub sessoes: Mutex<HashMap<String, (Uuid, DateTime<Utc>)>>,
        pub partidas: Mutex<Vec<(Uuid, DateTime<Utc>, u64)>>,
        /// O replay da última partida registrada.
        pub ultimo_replay: Mutex<Option<Vec<u8>>>,
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
            self.partidas.lock().unwrap().push((partida.conta_id, partida.jogada_em, partida.xp_ganho));
            *self.ultimo_replay.lock().unwrap() = partida.replay.clone();
            let mut contas = self.contas.lock().unwrap();
            let (_, conta) = contas.get_mut(&partida.conta_id).ok_or_else(|| FalhaExterna("sem conta".into()))?;
            conta.xp_total += partida.xp_ganho;
            Ok(conta.clone())
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
        let banco = Arc::new(Banco::default());
        let relogio = Arc::new(RelogioFalso::novo());
        let servicos = ServicosDaConta {
            contas: banco.clone(),
            sessoes: banco.clone(),
            login: Arc::new(GoogleFalso),
            relogio: relogio.clone(),
            gerador: Arc::new(GeradorEmSequencia::default()),
        };
        (servicos, banco, relogio)
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
    async fn partida_soma_xp_e_pode_subir_de_nivel() {
        let (servicos, _, _) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        let xp = servicos.registrar_partida(&entrada.token, partida(400, 400)).await.unwrap();
        assert_eq!(xp.xp_ganho, 150);
        assert_eq!((xp.antes.nivel, xp.depois.nivel), (1, 2));
        assert_eq!(servicos.conta_da_sessao(&entrada.token).await.unwrap().xp_total, 150);
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
    async fn guarda_o_replay_so_da_partida_que_vale_para_o_ranking() {
        let (servicos, banco, relogio) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        let com_replay = |derrota| PartidaEnviada {
            replay: Some(vec![1, 2, 3]),
            resumo: ResumoDaPartida {
                derrota,
                ..partida(1, 1).resumo
            },
            ..partida(1, 1)
        };

        servicos.registrar_partida(&entrada.token, com_replay(false)).await.unwrap();
        assert_eq!(*banco.ultimo_replay.lock().unwrap(), Some(vec![1, 2, 3]));

        relogio.andar(Duration::seconds(60));
        servicos.registrar_partida(&entrada.token, com_replay(true)).await.unwrap();
        assert_eq!(*banco.ultimo_replay.lock().unwrap(), None);
    }

    #[tokio::test]
    async fn replay_de_versao_desconhecida_e_recusado() {
        let (servicos, _, _) = servicos();
        let entrada = servicos.entrar_com_google(&pedido("bom")).await.unwrap();
        let estranho = PartidaEnviada {
            replay: Some(vec![42, 0]),
            ..partida(1, 1)
        };
        assert!(matches!(
            servicos.registrar_partida(&entrada.token, estranho).await,
            Err(ErroDaConta::PartidaInvalida(PartidaInvalida::ReplayInvalido))
        ));
    }
}
