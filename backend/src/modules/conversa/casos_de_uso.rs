use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use chrono::Duration;
use uuid::Uuid;

use super::dominio::{limpar_texto, MensagemPrivada, NaoLidas, NovaMensagem, Remetente, MENSAGENS_POR_MINUTO, MENSAGENS_POR_PAGINA};
use super::portas::{EntregaNaHora, RepositorioDeConversas};
use crate::modules::amizade::{Relacao, RepositorioDeAmizades};
use crate::modules::conta::{Conta, FalhaExterna, ServicosDaConta};
use crate::shared::limite::{dentro_do_limite, Janela};

#[derive(Clone)]
pub struct ServicosDeConversa {
    pub repositorio: Arc<dyn RepositorioDeConversas>,
    /// Só amigos conversam.
    pub amizades: Arc<dyn RepositorioDeAmizades>,
    pub entrega: Arc<dyn EntregaNaHora>,
    pub conta: ServicosDaConta,
    /// A janela de envios de cada conta. Só em memória: reiniciar a API zera, e tudo bem.
    pub janelas: Arc<Mutex<HashMap<Uuid, Janela>>>,
}

/// Acima disso, as janelas vencidas são jogadas fora para o mapa não crescer sem fim.
const JANELAS_GUARDADAS: usize = 10_000;

#[derive(Debug, thiserror::Error)]
pub enum ErroDaConversa {
    #[error("sessão inválida ou expirada")]
    SessaoInvalida,
    #[error("só dá para conversar com amigos")]
    NaoSaoAmigos,
    #[error("mensagem vazia")]
    TextoVazio,
    #[error("mensagens demais em pouco tempo")]
    RapidoDemais,
    #[error(transparent)]
    Falha(#[from] FalhaExterna),
}

impl ServicosDeConversa {
    /// Guarda a mensagem e tenta entregar na hora. Se a entrega falhar, ela continua no histórico.
    pub async fn enviar(&self, token: &str, para: Uuid, texto: &str) -> Result<MensagemPrivada, ErroDaConversa> {
        let conta = self.conta_da_sessao(token).await?;
        let texto = limpar_texto(texto).ok_or(ErroDaConversa::TextoVazio)?;
        self.exigir_amizade(conta.id, para).await?;
        self.contar_envio(conta.id)?;
        let mensagem = self
            .repositorio
            .guardar(&NovaMensagem {
                de: conta.id,
                para,
                texto,
                enviada_em: self.conta.relogio.agora(),
            })
            .await?;
        let remetente = Remetente {
            id: conta.id,
            nome: conta.nome,
            avatar: conta.avatar,
        };
        if let Err(falha) = self.entrega.entregar(&mensagem, &remetente).await {
            tracing::warn!(%falha, "não consegui entregar a mensagem privada pelo relay");
        }
        Ok(mensagem)
    }

    /// A conversa com o amigo, das mais novas para as mais velhas, uma página por vez.
    pub async fn historico(&self, token: &str, amigo: Uuid, antes: Option<i64>) -> Result<Vec<MensagemPrivada>, ErroDaConversa> {
        let conta = self.conta_da_sessao(token).await?;
        self.exigir_amizade(conta.id, amigo).await?;
        Ok(self.repositorio.mensagens(conta.id, amigo, antes, MENSAGENS_POR_PAGINA).await?)
    }

    pub async fn marcar_lidas(&self, token: &str, amigo: Uuid) -> Result<(), ErroDaConversa> {
        let conta = self.conta_da_sessao(token).await?;
        Ok(self.repositorio.marcar_lidas(conta.id, amigo, self.conta.relogio.agora()).await?)
    }

    /// Só as dos amigos de agora: quem deixou de ser amigo não fica com contador aceso.
    pub async fn nao_lidas(&self, token: &str) -> Result<Vec<NaoLidas>, ErroDaConversa> {
        let conta = self.conta_da_sessao(token).await?;
        let mut amigas = Vec::new();
        for nao_lidas in self.repositorio.nao_lidas(conta.id).await? {
            if self.amizades.relacao(conta.id, nao_lidas.de).await? == Relacao::Amigos {
                amigas.push(nao_lidas);
            }
        }
        Ok(amigas)
    }

    async fn conta_da_sessao(&self, token: &str) -> Result<Conta, ErroDaConversa> {
        self.conta.conta_da_sessao(token).await.map_err(|_| ErroDaConversa::SessaoInvalida)
    }

    async fn exigir_amizade(&self, quem: Uuid, outro: Uuid) -> Result<(), ErroDaConversa> {
        if self.amizades.relacao(quem, outro).await? == Relacao::Amigos {
            Ok(())
        } else {
            Err(ErroDaConversa::NaoSaoAmigos)
        }
    }

    fn contar_envio(&self, conta_id: Uuid) -> Result<(), ErroDaConversa> {
        let agora = self.conta.relogio.agora();
        let minuto = Duration::minutes(1);
        let mut janelas = self.janelas.lock().unwrap_or_else(|envenenado| envenenado.into_inner());
        if janelas.len() > JANELAS_GUARDADAS {
            janelas.retain(|_, j| agora - j.inicio < minuto);
        }
        let (passa, janela) = dentro_do_limite(janelas.get(&conta_id).copied(), agora, MENSAGENS_POR_MINUTO, minuto);
        janelas.insert(conta_id, janela);
        if passa {
            Ok(())
        } else {
            Err(ErroDaConversa::RapidoDemais)
        }
    }
}

/// Fakes das portas, para os testes daqui e os de integração (feature `testes`).
#[cfg(any(test, feature = "testes"))]
pub mod fakes {
    use async_trait::async_trait;
    use chrono::{DateTime, Utc};

    use super::*;
    use crate::modules::amizade::fakes::AmizadesEmMemoria;

    /// As mensagens guardadas com a hora em que foram lidas.
    #[derive(Default)]
    pub struct ConversasEmMemoria {
        pub mensagens: Mutex<Vec<(MensagemPrivada, Option<DateTime<Utc>>)>>,
    }

    #[async_trait]
    impl RepositorioDeConversas for ConversasEmMemoria {
        async fn guardar(&self, nova: &NovaMensagem) -> Result<MensagemPrivada, FalhaExterna> {
            let mut mensagens = self.mensagens.lock().unwrap();
            let mensagem = MensagemPrivada {
                id: mensagens.len() as i64 + 1,
                de: nova.de,
                para: nova.para,
                texto: nova.texto.clone(),
                enviada_em: nova.enviada_em,
            };
            mensagens.push((mensagem.clone(), None));
            Ok(mensagem)
        }

        async fn mensagens(&self, a: Uuid, b: Uuid, antes: Option<i64>, limite: u32) -> Result<Vec<MensagemPrivada>, FalhaExterna> {
            Ok(self
                .mensagens
                .lock()
                .unwrap()
                .iter()
                .rev()
                .map(|(m, _)| m)
                .filter(|m| (m.de == a && m.para == b) || (m.de == b && m.para == a))
                .filter(|m| antes.is_none_or(|antes| m.id < antes))
                .take(limite as usize)
                .cloned()
                .collect())
        }

        async fn marcar_lidas(&self, quem: Uuid, de: Uuid, agora: DateTime<Utc>) -> Result<(), FalhaExterna> {
            for (m, lida) in self.mensagens.lock().unwrap().iter_mut() {
                if m.para == quem && m.de == de && lida.is_none() {
                    *lida = Some(agora);
                }
            }
            Ok(())
        }

        async fn nao_lidas(&self, quem: Uuid) -> Result<Vec<NaoLidas>, FalhaExterna> {
            let mut por_remetente: Vec<NaoLidas> = Vec::new();
            for (m, lida) in self.mensagens.lock().unwrap().iter() {
                if m.para != quem || lida.is_some() {
                    continue;
                }
                match por_remetente.iter_mut().find(|n| n.de == m.de) {
                    Some(n) => n.quantas += 1,
                    None => por_remetente.push(NaoLidas { de: m.de, quantas: 1 }),
                }
            }
            Ok(por_remetente)
        }
    }

    /// Guarda o que seria entregue; com `falhar`, a entrega dá erro.
    #[derive(Default)]
    pub struct EntregaFalsa {
        pub entregues: Mutex<Vec<(MensagemPrivada, Remetente)>>,
        pub falhar: bool,
    }

    #[async_trait]
    impl EntregaNaHora for EntregaFalsa {
        async fn entregar(&self, mensagem: &MensagemPrivada, remetente: &Remetente) -> Result<(), FalhaExterna> {
            if self.falhar {
                return Err(FalhaExterna("relay fora do ar".into()));
            }
            self.entregues.lock().unwrap().push((mensagem.clone(), remetente.clone()));
            Ok(())
        }
    }

    /// Sem nenhuma amizade, para os testes que não falam de conversa.
    pub fn servicos_vazios(conta: ServicosDaConta) -> ServicosDeConversa {
        servicos_de_conversa(conta, Arc::new(AmizadesEmMemoria::default())).0
    }

    /// Os serviços de conversa sobre as amizades do teste.
    pub fn servicos_de_conversa(conta: ServicosDaConta, amizades: Arc<AmizadesEmMemoria>) -> (ServicosDeConversa, Arc<ConversasEmMemoria>, Arc<EntregaFalsa>) {
        let repositorio = Arc::new(ConversasEmMemoria::default());
        let entrega = Arc::new(EntregaFalsa::default());
        (
            ServicosDeConversa {
                repositorio: repositorio.clone(),
                amizades,
                entrega: entrega.clone(),
                conta,
                janelas: Default::default(),
            },
            repositorio,
            entrega,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::fakes::{servicos_de_conversa, ConversasEmMemoria, EntregaFalsa};
    use super::*;
    use crate::modules::amizade::fakes::servicos_de_amizade;
    use crate::modules::conta::fakes::{pedido, servicos};

    struct Cena {
        servicos: ServicosDeConversa,
        repositorio: Arc<ConversasEmMemoria>,
        entrega: Arc<EntregaFalsa>,
        /// (id, token) de cada pessoa.
        ana: (Uuid, String),
        beto: (Uuid, String),
        caio: (Uuid, String),
    }

    /// Ana e Beto são amigos; Caio não é amigo de ninguém.
    async fn cena() -> Cena {
        let (conta, banco, _) = servicos();
        let mut pessoas = Vec::new();
        for nome in ["ana", "beto", "caio"] {
            let sessao = conta.entrar_com_google(&pedido(&format!("pessoa:{nome}"))).await.unwrap();
            pessoas.push((sessao.conta.id, sessao.token));
        }
        let (_, amizades) = servicos_de_amizade(conta.clone(), banco);
        let agora = conta.relogio.agora();
        amizades.criar_pedido(pessoas[0].0, pessoas[1].0, agora).await.unwrap();
        amizades.aceitar(pessoas[0].0, pessoas[1].0, agora).await.unwrap();
        let (servicos, repositorio, entrega) = servicos_de_conversa(conta, amizades);
        let mut pessoas = pessoas.into_iter();
        Cena {
            servicos,
            repositorio,
            entrega,
            ana: pessoas.next().unwrap(),
            beto: pessoas.next().unwrap(),
            caio: pessoas.next().unwrap(),
        }
    }

    #[tokio::test]
    async fn amigo_manda_guarda_com_texto_limpo_e_entrega_na_hora() {
        let c = cena().await;
        let mensagem = c.servicos.enviar(&c.ana.1, c.beto.0, "  bora\njogar?  ").await.unwrap();
        assert_eq!(mensagem.texto, "bora jogar?");
        assert_eq!((mensagem.de, mensagem.para), (c.ana.0, c.beto.0));
        let entregues = c.entrega.entregues.lock().unwrap();
        assert_eq!(entregues.len(), 1);
        assert_eq!(entregues[0].0, mensagem);
        assert_eq!(entregues[0].1.id, c.ana.0);
    }

    #[tokio::test]
    async fn quem_nao_e_amigo_nao_manda_nem_le() {
        let c = cena().await;
        assert!(matches!(c.servicos.enviar(&c.caio.1, c.ana.0, "oi").await, Err(ErroDaConversa::NaoSaoAmigos)));
        assert!(matches!(
            c.servicos.historico(&c.caio.1, c.ana.0, None).await,
            Err(ErroDaConversa::NaoSaoAmigos)
        ));
        assert!(c.repositorio.mensagens.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn texto_vazio_e_sessao_invalida_sao_recusados() {
        let c = cena().await;
        assert!(matches!(c.servicos.enviar(&c.ana.1, c.beto.0, " \n ").await, Err(ErroDaConversa::TextoVazio)));
        assert!(matches!(
            c.servicos.enviar("token-falso", c.beto.0, "oi").await,
            Err(ErroDaConversa::SessaoInvalida)
        ));
    }

    #[tokio::test]
    async fn relay_fora_do_ar_nao_perde_a_mensagem() {
        let c = cena().await;
        let servicos = ServicosDeConversa {
            entrega: Arc::new(EntregaFalsa {
                falhar: true,
                ..Default::default()
            }),
            ..c.servicos.clone()
        };
        servicos.enviar(&c.ana.1, c.beto.0, "oi").await.unwrap();
        assert_eq!(c.servicos.historico(&c.beto.1, c.ana.0, None).await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn limita_os_envios_por_minuto() {
        let c = cena().await;
        for _ in 0..MENSAGENS_POR_MINUTO {
            c.servicos.enviar(&c.ana.1, c.beto.0, "oi").await.unwrap();
        }
        assert!(matches!(c.servicos.enviar(&c.ana.1, c.beto.0, "oi").await, Err(ErroDaConversa::RapidoDemais)));
    }

    #[tokio::test]
    async fn o_historico_vem_dos_dois_lados_paginado_pelo_id() {
        let c = cena().await;
        for i in 0..3 {
            c.servicos.enviar(&c.ana.1, c.beto.0, &format!("a{i}")).await.unwrap();
            c.servicos.enviar(&c.beto.1, c.ana.0, &format!("b{i}")).await.unwrap();
        }
        let todas = c.servicos.historico(&c.ana.1, c.beto.0, None).await.unwrap();
        assert_eq!(todas.iter().map(|m| m.texto.as_str()).collect::<Vec<_>>(), ["b2", "a2", "b1", "a1", "b0", "a0"]);
        let antes = c.servicos.historico(&c.ana.1, c.beto.0, Some(todas[3].id)).await.unwrap();
        assert_eq!(antes.iter().map(|m| m.texto.as_str()).collect::<Vec<_>>(), ["b0", "a0"]);
    }

    #[tokio::test]
    async fn conta_as_nao_lidas_por_amigo_e_zera_ao_ler() {
        let c = cena().await;
        c.servicos.enviar(&c.ana.1, c.beto.0, "oi").await.unwrap();
        c.servicos.enviar(&c.ana.1, c.beto.0, "ta ai?").await.unwrap();
        assert_eq!(c.servicos.nao_lidas(&c.beto.1).await.unwrap(), [NaoLidas { de: c.ana.0, quantas: 2 }]);
        assert!(c.servicos.nao_lidas(&c.ana.1).await.unwrap().is_empty());
        c.servicos.marcar_lidas(&c.beto.1, c.ana.0).await.unwrap();
        assert!(c.servicos.nao_lidas(&c.beto.1).await.unwrap().is_empty());
    }
}
