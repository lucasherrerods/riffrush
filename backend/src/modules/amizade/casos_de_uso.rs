use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use chrono::Duration;
use uuid::Uuid;

use super::dominio::{decidir_pedido, gerar_codigo, normalizar_codigo, Decisao, PedidoRecusado, Pessoa, Relacao, Sugestao, PEDIDOS_POR_HORA, SUGESTOES};
use super::portas::RepositorioDeAmizades;
use crate::modules::conta::{Conta, FalhaExterna, ServicosDaConta};
use crate::shared::limite::{dentro_do_limite, Janela};

#[derive(Clone)]
pub struct ServicosDeAmizade {
    pub repositorio: Arc<dyn RepositorioDeAmizades>,
    /// Para achar a conta pela sessão, ler o relógio e sortear os códigos.
    pub conta: ServicosDaConta,
    /// A janela de pedidos de cada conta. Só em memória: reiniciar a API zera, e tudo bem.
    pub janelas: Arc<Mutex<HashMap<Uuid, Janela>>>,
}

/// Sorteios antes de desistir de um código livre. Com bilhões de códigos, repetir já é raro.
const TENTATIVAS_DE_CODIGO: usize = 5;
/// Acima disso, as janelas vencidas são jogadas fora para o mapa não crescer sem fim.
const JANELAS_GUARDADAS: usize = 10_000;

#[derive(Debug, thiserror::Error)]
pub enum ErroDaAmizade {
    #[error("sessão inválida ou expirada")]
    SessaoInvalida,
    #[error("código de amigo inválido")]
    CodigoInvalido,
    #[error("ninguém com esse código")]
    NaoEncontrada,
    #[error("pedido não encontrado")]
    PedidoNaoEncontrado,
    #[error("pedidos demais em pouco tempo")]
    RapidoDemais,
    #[error(transparent)]
    Recusado(#[from] PedidoRecusado),
    #[error(transparent)]
    Falha(#[from] FalhaExterna),
}

/// A quem o pedido vai: pelo código que a pessoa passou ou pela conta (sugestões, ranking, chat).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Alvo {
    Codigo(String),
    Conta(Uuid),
}

/// Como ficou depois do pedido.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Pedido {
    Enviado,
    /// A outra pessoa já tinha pedido: agora são amigos.
    Aceito,
}

pub struct Listas {
    pub codigo: String,
    pub pessoas: Vec<Pessoa>,
}

impl ServicosDeAmizade {
    /// As listas da conta. Quem abre as listas conta como visto agora.
    pub async fn listas(&self, token: &str) -> Result<Listas, ErroDaAmizade> {
        let conta = self.conta_da_sessao(token).await?;
        let codigo = self.garantir_codigo(conta.id).await?;
        self.repositorio.marcar_visto(conta.id, self.conta.relogio.agora()).await?;
        Ok(Listas {
            codigo,
            pessoas: self.repositorio.pessoas(conta.id).await?,
        })
    }

    pub async fn sugestoes(&self, token: &str) -> Result<Vec<Sugestao>, ErroDaAmizade> {
        let conta = self.conta_da_sessao(token).await?;
        Ok(self.repositorio.sugestoes(conta.id, SUGESTOES).await?)
    }

    pub async fn pedir(&self, token: &str, alvo: Alvo) -> Result<Pedido, ErroDaAmizade> {
        let conta = self.conta_da_sessao(token).await?;
        let outro = self.achar(alvo).await?;
        self.contar_pedido(conta.id)?;
        let relacao = self.repositorio.relacao(conta.id, outro).await?;
        let contagens = self.repositorio.contagens(conta.id, outro).await?;
        let agora = self.conta.relogio.agora();
        match decidir_pedido(conta.id, outro, relacao, contagens)? {
            Decisao::CriarPedido => self.repositorio.criar_pedido(conta.id, outro, agora).await?,
            Decisao::Aceitar => {
                self.repositorio.aceitar(outro, conta.id, agora).await?;
                return Ok(Pedido::Aceito);
            }
            Decisao::Ignorar => {}
        }
        Ok(Pedido::Enviado)
    }

    pub async fn aceitar(&self, token: &str, solicitante: Uuid) -> Result<(), ErroDaAmizade> {
        let conta = self.conta_da_sessao(token).await?;
        let relacao = self.repositorio.relacao(conta.id, solicitante).await?;
        if relacao != Relacao::PedidoRecebido {
            return Err(ErroDaAmizade::PedidoNaoEncontrado);
        }
        let contagens = self.repositorio.contagens(conta.id, solicitante).await?;
        decidir_pedido(conta.id, solicitante, relacao, contagens)?;
        if !self.repositorio.aceitar(solicitante, conta.id, self.conta.relogio.agora()).await? {
            return Err(ErroDaAmizade::PedidoNaoEncontrado);
        }
        Ok(())
    }

    /// Remove o amigo, recusa o pedido recebido ou cancela o enviado.
    pub async fn desfazer(&self, token: &str, outro: Uuid) -> Result<(), ErroDaAmizade> {
        let conta = self.conta_da_sessao(token).await?;
        Ok(self.repositorio.desfazer(conta.id, outro).await?)
    }

    pub async fn bloquear(&self, token: &str, outro: Uuid) -> Result<(), ErroDaAmizade> {
        let conta = self.conta_da_sessao(token).await?;
        if conta.id == outro {
            return Err(PedidoRecusado::SiMesmo.into());
        }
        if self.conta.contas.buscar(outro).await?.is_none() {
            return Err(ErroDaAmizade::NaoEncontrada);
        }
        Ok(self.repositorio.bloquear(conta.id, outro, self.conta.relogio.agora()).await?)
    }

    pub async fn desbloquear(&self, token: &str, outro: Uuid) -> Result<(), ErroDaAmizade> {
        let conta = self.conta_da_sessao(token).await?;
        Ok(self.repositorio.desbloquear(conta.id, outro).await?)
    }

    async fn conta_da_sessao(&self, token: &str) -> Result<Conta, ErroDaAmizade> {
        self.conta.conta_da_sessao(token).await.map_err(|_| ErroDaAmizade::SessaoInvalida)
    }

    async fn achar(&self, alvo: Alvo) -> Result<Uuid, ErroDaAmizade> {
        match alvo {
            Alvo::Codigo(texto) => {
                let codigo = normalizar_codigo(&texto).ok_or(ErroDaAmizade::CodigoInvalido)?;
                self.repositorio.conta_do_codigo(&codigo).await?.ok_or(ErroDaAmizade::NaoEncontrada)
            }
            Alvo::Conta(id) => match self.conta.contas.buscar(id).await? {
                Some(conta) => Ok(conta.id),
                None => Err(ErroDaAmizade::NaoEncontrada),
            },
        }
    }

    fn contar_pedido(&self, conta_id: Uuid) -> Result<(), ErroDaAmizade> {
        let agora = self.conta.relogio.agora();
        let hora = Duration::hours(1);
        let mut janelas = self.janelas.lock().unwrap_or_else(|envenenado| envenenado.into_inner());
        if janelas.len() > JANELAS_GUARDADAS {
            janelas.retain(|_, j| agora - j.inicio < hora);
        }
        let (passa, janela) = dentro_do_limite(janelas.get(&conta_id).copied(), agora, PEDIDOS_POR_HORA, hora);
        janelas.insert(conta_id, janela);
        if passa {
            Ok(())
        } else {
            Err(ErroDaAmizade::RapidoDemais)
        }
    }

    async fn garantir_codigo(&self, conta_id: Uuid) -> Result<String, ErroDaAmizade> {
        if let Some(codigo) = self.repositorio.codigo(conta_id).await? {
            return Ok(codigo);
        }
        for _ in 0..TENTATIVAS_DE_CODIGO {
            if let Some(codigo) = self.repositorio.guardar_codigo(conta_id, &gerar_codigo(self.conta.gerador.id())).await? {
                return Ok(codigo);
            }
        }
        Err(FalhaExterna("não consegui sortear um código de amigo livre".into()).into())
    }
}

/// Fakes das portas, para os testes daqui e os de integração (feature `testes`).
#[cfg(any(test, feature = "testes"))]
pub mod fakes {
    use async_trait::async_trait;
    use chrono::{DateTime, Utc};

    use super::super::dominio::{Contagens, Vinculo};
    use super::*;
    use crate::modules::conta::fakes::Banco;

    /// (solicitante, destinatário, aceita, quando).
    pub type LinhaDeAmizade = (Uuid, Uuid, bool, DateTime<Utc>);

    #[derive(Default)]
    pub struct AmizadesEmMemoria {
        /// As contas que existem, para os nomes.
        pub contas: Arc<Banco>,
        pub codigos: Mutex<HashMap<Uuid, String>>,
        pub vistos: Mutex<HashMap<Uuid, DateTime<Utc>>>,
        pub amizades: Mutex<Vec<LinhaDeAmizade>>,
        /// (quem, bloqueado, quando).
        pub bloqueios: Mutex<Vec<(Uuid, Uuid, DateTime<Utc>)>>,
    }

    impl AmizadesEmMemoria {
        fn par(&self, a: Uuid, b: Uuid) -> Option<LinhaDeAmizade> {
            self.amizades
                .lock()
                .unwrap()
                .iter()
                .find(|(s, d, _, _)| (*s == a && *d == b) || (*s == b && *d == a))
                .copied()
        }

        fn amigos(&self, conta: Uuid) -> Vec<Uuid> {
            self.amizades
                .lock()
                .unwrap()
                .iter()
                .filter(|(_, _, aceita, _)| *aceita)
                .filter_map(|(s, d, _, _)| {
                    if *s == conta {
                        Some(*d)
                    } else if *d == conta {
                        Some(*s)
                    } else {
                        None
                    }
                })
                .collect()
        }

        fn pessoa(&self, id: Uuid, desde: DateTime<Utc>, vinculo: Vinculo) -> Pessoa {
            let conta = self.contas.contas.lock().unwrap().get(&id).map(|(_, c)| c.clone()).unwrap();
            Pessoa {
                conta_id: id,
                nome: conta.nome,
                avatar: conta.avatar,
                xp_total: conta.xp_total,
                visto_em: self.vistos.lock().unwrap().get(&id).copied(),
                desde,
                vinculo,
            }
        }
    }

    #[async_trait]
    impl RepositorioDeAmizades for AmizadesEmMemoria {
        async fn codigo(&self, conta_id: Uuid) -> Result<Option<String>, FalhaExterna> {
            Ok(self.codigos.lock().unwrap().get(&conta_id).cloned())
        }
        async fn guardar_codigo(&self, conta_id: Uuid, codigo: &str) -> Result<Option<String>, FalhaExterna> {
            let mut codigos = self.codigos.lock().unwrap();
            if let Some(atual) = codigos.get(&conta_id) {
                return Ok(Some(atual.clone()));
            }
            if codigos.values().any(|c| c == codigo) {
                return Ok(None);
            }
            codigos.insert(conta_id, codigo.into());
            Ok(Some(codigo.into()))
        }
        async fn conta_do_codigo(&self, codigo: &str) -> Result<Option<Uuid>, FalhaExterna> {
            Ok(self.codigos.lock().unwrap().iter().find(|(_, c)| *c == codigo).map(|(id, _)| *id))
        }
        async fn marcar_visto(&self, conta_id: Uuid, agora: DateTime<Utc>) -> Result<(), FalhaExterna> {
            self.vistos.lock().unwrap().insert(conta_id, agora);
            Ok(())
        }
        async fn relacao(&self, quem: Uuid, outro: Uuid) -> Result<Relacao, FalhaExterna> {
            let bloqueios = self.bloqueios.lock().unwrap().clone();
            if bloqueios.iter().any(|(q, b, _)| *q == quem && *b == outro) {
                return Ok(Relacao::Bloqueou);
            }
            if bloqueios.iter().any(|(q, b, _)| *q == outro && *b == quem) {
                return Ok(Relacao::FoiBloqueado);
            }
            Ok(match self.par(quem, outro) {
                None => Relacao::Nenhuma,
                Some((_, _, true, _)) => Relacao::Amigos,
                Some((s, _, false, _)) if s == quem => Relacao::PedidoEnviado,
                Some(_) => Relacao::PedidoRecebido,
            })
        }
        async fn contagens(&self, quem: Uuid, outro: Uuid) -> Result<Contagens, FalhaExterna> {
            let enviados = self.amizades.lock().unwrap().iter().filter(|(s, _, aceita, _)| *s == quem && !aceita).count();
            Ok(Contagens {
                amigos_de_quem_pede: self.amigos(quem).len() as u32,
                enviados_de_quem_pede: enviados as u32,
                amigos_do_outro: self.amigos(outro).len() as u32,
            })
        }
        async fn criar_pedido(&self, de: Uuid, para: Uuid, agora: DateTime<Utc>) -> Result<(), FalhaExterna> {
            if self.par(de, para).is_none() {
                self.amizades.lock().unwrap().push((de, para, false, agora));
            }
            Ok(())
        }
        async fn aceitar(&self, solicitante: Uuid, destinatario: Uuid, agora: DateTime<Utc>) -> Result<bool, FalhaExterna> {
            let mut amizades = self.amizades.lock().unwrap();
            match amizades.iter_mut().find(|(s, d, aceita, _)| *s == solicitante && *d == destinatario && !aceita) {
                Some(linha) => {
                    linha.2 = true;
                    linha.3 = agora;
                    Ok(true)
                }
                None => Ok(false),
            }
        }
        async fn desfazer(&self, a: Uuid, b: Uuid) -> Result<(), FalhaExterna> {
            self.amizades
                .lock()
                .unwrap()
                .retain(|(s, d, _, _)| !((*s == a && *d == b) || (*s == b && *d == a)));
            Ok(())
        }
        async fn bloquear(&self, quem: Uuid, outro: Uuid, agora: DateTime<Utc>) -> Result<(), FalhaExterna> {
            self.desfazer(quem, outro).await?;
            let mut bloqueios = self.bloqueios.lock().unwrap();
            if !bloqueios.iter().any(|(q, b, _)| *q == quem && *b == outro) {
                bloqueios.push((quem, outro, agora));
            }
            Ok(())
        }
        async fn desbloquear(&self, quem: Uuid, outro: Uuid) -> Result<(), FalhaExterna> {
            self.bloqueios.lock().unwrap().retain(|(q, b, _)| !(*q == quem && *b == outro));
            Ok(())
        }
        async fn pessoas(&self, conta_id: Uuid) -> Result<Vec<Pessoa>, FalhaExterna> {
            let amizades = self.amizades.lock().unwrap().clone();
            let mut pessoas: Vec<Pessoa> = amizades
                .iter()
                .filter_map(|&(s, d, aceita, quando)| match (aceita, s == conta_id, d == conta_id) {
                    (true, true, _) => Some(self.pessoa(d, quando, Vinculo::Amigo)),
                    (true, _, true) => Some(self.pessoa(s, quando, Vinculo::Amigo)),
                    (false, true, _) => Some(self.pessoa(d, quando, Vinculo::Enviado)),
                    (false, _, true) => Some(self.pessoa(s, quando, Vinculo::Recebido)),
                    _ => None,
                })
                .collect();
            let bloqueios = self.bloqueios.lock().unwrap().clone();
            pessoas.extend(
                bloqueios
                    .iter()
                    .filter(|(q, _, _)| *q == conta_id)
                    .map(|&(_, b, quando)| self.pessoa(b, quando, Vinculo::Bloqueado)),
            );
            Ok(pessoas)
        }
        async fn sugestoes(&self, conta_id: Uuid, limite: u32) -> Result<Vec<Sugestao>, FalhaExterna> {
            let meus = self.amigos(conta_id);
            let mut contagem: HashMap<Uuid, u32> = HashMap::new();
            for amigo in &meus {
                for candidato in self.amigos(*amigo) {
                    let livre = candidato != conta_id
                        && self.par(conta_id, candidato).is_none()
                        && !self
                            .bloqueios
                            .lock()
                            .unwrap()
                            .iter()
                            .any(|(q, b, _)| (*q == conta_id && *b == candidato) || (*q == candidato && *b == conta_id));
                    if livre {
                        *contagem.entry(candidato).or_default() += 1;
                    }
                }
            }
            let mut sugestoes: Vec<Sugestao> = contagem
                .into_iter()
                .map(|(id, em_comum)| {
                    let pessoa = self.pessoa(id, DateTime::UNIX_EPOCH, Vinculo::Amigo);
                    Sugestao {
                        conta_id: id,
                        nome: pessoa.nome,
                        avatar: pessoa.avatar,
                        xp_total: pessoa.xp_total,
                        amigos_em_comum: em_comum,
                    }
                })
                .collect();
            sugestoes.sort_by_key(|s| std::cmp::Reverse(s.amigos_em_comum));
            sugestoes.truncate(limite as usize);
            Ok(sugestoes)
        }
    }

    /// Os serviços de amizade sobre as contas do teste.
    pub fn servicos_de_amizade(conta: ServicosDaConta, contas: Arc<Banco>) -> (ServicosDeAmizade, Arc<AmizadesEmMemoria>) {
        let repositorio = Arc::new(AmizadesEmMemoria { contas, ..Default::default() });
        (
            ServicosDeAmizade {
                repositorio: repositorio.clone(),
                conta,
                janelas: Default::default(),
            },
            repositorio,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::super::dominio::Vinculo;
    use super::fakes::servicos_de_amizade;
    use super::*;
    use crate::modules::conta::fakes::{pedido, servicos};

    /// Três pessoas logadas: devolve os serviços e (id, token) de cada uma.
    async fn tres_pessoas() -> (ServicosDeAmizade, [(Uuid, String); 3]) {
        let (conta, banco, _) = servicos();
        let mut pessoas = Vec::new();
        for nome in ["ana", "beto", "caio"] {
            let entrada = conta.entrar_com_google(&pedido(&format!("pessoa:{nome}"))).await.unwrap();
            pessoas.push((entrada.conta.id, entrada.token));
        }
        let (amizade, _) = servicos_de_amizade(conta, banco);
        (amizade, pessoas.try_into().unwrap())
    }

    fn vinculo(listas: &Listas, id: Uuid) -> Option<Vinculo> {
        listas.pessoas.iter().find(|p| p.conta_id == id).map(|p| p.vinculo)
    }

    #[tokio::test]
    async fn o_codigo_e_criado_uma_vez_e_acha_a_conta() {
        let (amizade, [(ana_id, ana), (_, beto), _]) = tres_pessoas().await;
        let codigo = amizade.listas(&beto).await.unwrap().codigo;
        assert_eq!(amizade.listas(&beto).await.unwrap().codigo, codigo);

        let resultado = amizade.pedir(&ana, Alvo::Codigo(codigo.to_lowercase())).await.unwrap();

        assert_eq!(resultado, Pedido::Enviado);
        let listas_do_beto = amizade.listas(&beto).await.unwrap();
        assert_eq!(listas_do_beto.pessoas.len(), 1);
        assert_eq!(listas_do_beto.pessoas[0].vinculo, Vinculo::Recebido);
        assert_eq!(listas_do_beto.pessoas[0].conta_id, ana_id);
    }

    #[tokio::test]
    async fn aceitar_vira_amizade_dos_dois_lados() {
        let (amizade, [(ana_id, ana), (beto_id, beto), _]) = tres_pessoas().await;
        amizade.pedir(&ana, Alvo::Conta(beto_id)).await.unwrap();
        assert_eq!(vinculo(&amizade.listas(&ana).await.unwrap(), beto_id), Some(Vinculo::Enviado));

        amizade.aceitar(&beto, ana_id).await.unwrap();

        assert_eq!(vinculo(&amizade.listas(&ana).await.unwrap(), beto_id), Some(Vinculo::Amigo));
        assert_eq!(vinculo(&amizade.listas(&beto).await.unwrap(), ana_id), Some(Vinculo::Amigo));
    }

    #[tokio::test]
    async fn quem_pediu_nao_pode_aceitar_o_proprio_pedido() {
        let (amizade, [(_, ana), (beto_id, _), _]) = tres_pessoas().await;
        amizade.pedir(&ana, Alvo::Conta(beto_id)).await.unwrap();
        assert!(matches!(amizade.aceitar(&ana, beto_id).await, Err(ErroDaAmizade::PedidoNaoEncontrado)));
    }

    #[tokio::test]
    async fn pedido_cruzado_aceita_na_hora() {
        let (amizade, [(ana_id, ana), (beto_id, beto), _]) = tres_pessoas().await;
        amizade.pedir(&ana, Alvo::Conta(beto_id)).await.unwrap();
        assert_eq!(amizade.pedir(&beto, Alvo::Conta(ana_id)).await.unwrap(), Pedido::Aceito);
        assert_eq!(vinculo(&amizade.listas(&ana).await.unwrap(), beto_id), Some(Vinculo::Amigo));
    }

    #[tokio::test]
    async fn desfazer_remove_recusa_e_cancela() {
        let (amizade, [(ana_id, ana), (beto_id, beto), _]) = tres_pessoas().await;
        amizade.pedir(&ana, Alvo::Conta(beto_id)).await.unwrap();
        amizade.desfazer(&beto, ana_id).await.unwrap();
        assert!(amizade.listas(&ana).await.unwrap().pessoas.is_empty());
        // Recusado, dá para pedir de novo.
        amizade.pedir(&ana, Alvo::Conta(beto_id)).await.unwrap();
    }

    #[tokio::test]
    async fn bloqueado_pede_sem_saber_e_nada_chega() {
        let (amizade, [(ana_id, ana), (beto_id, beto), _]) = tres_pessoas().await;
        amizade.bloquear(&ana, beto_id).await.unwrap();

        assert_eq!(amizade.pedir(&beto, Alvo::Conta(ana_id)).await.unwrap(), Pedido::Enviado);

        let listas_da_ana = amizade.listas(&ana).await.unwrap();
        assert_eq!(vinculo(&listas_da_ana, beto_id), Some(Vinculo::Bloqueado));
        assert!(amizade.listas(&beto).await.unwrap().pessoas.is_empty());
        assert!(matches!(
            amizade.pedir(&ana, Alvo::Conta(beto_id)).await,
            Err(ErroDaAmizade::Recusado(PedidoRecusado::Bloqueada))
        ));
        amizade.desbloquear(&ana, beto_id).await.unwrap();
        assert!(amizade.listas(&ana).await.unwrap().pessoas.is_empty());
    }

    #[tokio::test]
    async fn bloquear_desfaz_a_amizade() {
        let (amizade, [(ana_id, ana), (beto_id, beto), _]) = tres_pessoas().await;
        amizade.pedir(&ana, Alvo::Conta(beto_id)).await.unwrap();
        amizade.aceitar(&beto, ana_id).await.unwrap();
        amizade.bloquear(&beto, ana_id).await.unwrap();
        assert!(amizade.listas(&ana).await.unwrap().pessoas.is_empty());
    }

    #[tokio::test]
    async fn codigo_errado_ou_de_ninguem_e_conta_que_nao_existe() {
        let (amizade, [(_, ana), _, _]) = tres_pessoas().await;
        assert!(matches!(
            amizade.pedir(&ana, Alvo::Codigo("xx".into())).await,
            Err(ErroDaAmizade::CodigoInvalido)
        ));
        assert!(matches!(
            amizade.pedir(&ana, Alvo::Codigo("RIFF-ABCDEF".into())).await,
            Err(ErroDaAmizade::NaoEncontrada)
        ));
        assert!(matches!(
            amizade.pedir(&ana, Alvo::Conta(Uuid::from_u128(999))).await,
            Err(ErroDaAmizade::NaoEncontrada)
        ));
        assert!(matches!(amizade.bloquear(&ana, Uuid::from_u128(999)).await, Err(ErroDaAmizade::NaoEncontrada)));
        assert!(matches!(amizade.listas("inventado").await, Err(ErroDaAmizade::SessaoInvalida)));
    }

    #[tokio::test]
    async fn pedidos_demais_na_mesma_hora_esperam() {
        let (amizade, [(_, ana), (beto_id, _), _]) = tres_pessoas().await;
        for _ in 0..PEDIDOS_POR_HORA {
            // Repetido é recusado, mas conta na janela do mesmo jeito.
            let _ = amizade.pedir(&ana, Alvo::Conta(beto_id)).await;
        }
        assert!(matches!(amizade.pedir(&ana, Alvo::Conta(beto_id)).await, Err(ErroDaAmizade::RapidoDemais)));
    }

    #[tokio::test]
    async fn sugere_amigos_de_amigos() {
        let (amizade, [(ana_id, ana), (beto_id, beto), (caio_id, caio)]) = tres_pessoas().await;
        amizade.pedir(&ana, Alvo::Conta(beto_id)).await.unwrap();
        amizade.aceitar(&beto, ana_id).await.unwrap();
        amizade.pedir(&caio, Alvo::Conta(beto_id)).await.unwrap();
        amizade.aceitar(&beto, caio_id).await.unwrap();

        let sugestoes = amizade.sugestoes(&ana).await.unwrap();

        assert_eq!(sugestoes.len(), 1);
        assert_eq!(sugestoes[0].conta_id, caio_id);
        assert_eq!(sugestoes[0].amigos_em_comum, 1);
    }
}
