use std::sync::Arc;

use uuid::Uuid;

use super::dominio::{pedido_confere, Banido, Denuncia, DenunciaInvalida, DenunciaRecebida, Situacao, DENUNCIAS_NA_TELA};
use super::portas::{AvisoAoRelay, AvisoDeModeracao, RepositorioDeModeracao};
use crate::modules::conta::{FalhaExterna, ServicosDaConta};

#[derive(Clone)]
pub struct ServicosDeModeracao {
    pub repositorio: Arc<dyn RepositorioDeModeracao>,
    pub relay: Arc<dyn AvisoAoRelay>,
    /// Para achar a conta pela sessão e ler o relógio.
    pub conta: ServicosDaConta,
    /// O mesmo segredo do relay, que assina as denúncias. Sem ele, o relay não consegue denunciar.
    pub segredo: Option<Arc<Vec<u8>>>,
}

#[derive(Debug, thiserror::Error)]
pub enum ErroDaModeracao {
    #[error("a moderação está desligada neste servidor")]
    Desligada,
    #[error("sessão inválida ou expirada")]
    SessaoInvalida,
    #[error("só a moderação pode fazer isso")]
    SoAModeracao,
    #[error("pedido sem a assinatura do relay")]
    AssinaturaInvalida,
    #[error("não dá para banir alguém da moderação")]
    ModeracaoNaoEBanida,
    #[error("conta não encontrada")]
    ContaNaoEncontrada,
    #[error(transparent)]
    Invalida(#[from] DenunciaInvalida),
    #[error(transparent)]
    Falha(#[from] FalhaExterna),
}

impl ServicosDeModeracao {
    /// Admin e banido vão na ficha de quem entra no chat global.
    pub async fn situacao(&self, conta_id: Uuid) -> Result<Situacao, FalhaExterna> {
        self.repositorio.situacao(conta_id).await
    }

    /// Confere que o pedido veio do relay, que tem o mesmo segredo, e é recente.
    pub fn conferir_relay(&self, hora: i64, assinatura: &str, corpo: &[u8]) -> Result<(), ErroDaModeracao> {
        let segredo = self.segredo.as_ref().ok_or(ErroDaModeracao::Desligada)?;
        let agora = self.conta.relogio.agora().timestamp();
        if pedido_confere(segredo, hora, agora, corpo, assinatura) {
            Ok(())
        } else {
            Err(ErroDaModeracao::AssinaturaInvalida)
        }
    }

    /// Chamado depois de `conferir_relay`: o relay manda a cópia verdadeira da mensagem.
    pub async fn registrar_denuncia(&self, denuncia: Denuncia) -> Result<(), ErroDaModeracao> {
        let denuncia = denuncia.validar()?;
        Ok(self.repositorio.registrar_denuncia(&denuncia).await?)
    }

    pub async fn denuncias(&self, token: &str) -> Result<Vec<DenunciaRecebida>, ErroDaModeracao> {
        self.exigir_moderacao(token).await?;
        Ok(self.repositorio.denuncias(DENUNCIAS_NA_TELA).await?)
    }

    pub async fn resolver(&self, token: &str, mensagem_n: i64) -> Result<(), ErroDaModeracao> {
        self.exigir_moderacao(token).await?;
        Ok(self.repositorio.resolver(mensagem_n).await?)
    }

    pub async fn banidos(&self, token: &str) -> Result<Vec<Banido>, ErroDaModeracao> {
        self.exigir_moderacao(token).await?;
        Ok(self.repositorio.banidos().await?)
    }

    pub async fn banir(&self, token: &str, conta_id: Uuid) -> Result<(), ErroDaModeracao> {
        let admin = self.exigir_moderacao(token).await?;
        if self.repositorio.situacao(conta_id).await?.admin {
            return Err(ErroDaModeracao::ModeracaoNaoEBanida);
        }
        if !self.repositorio.banir(conta_id, admin).await? {
            return Err(ErroDaModeracao::ContaNaoEncontrada);
        }
        self.avisar_relay(AvisoDeModeracao::Banir(conta_id)).await;
        Ok(())
    }

    pub async fn desbanir(&self, token: &str, conta_id: Uuid) -> Result<(), ErroDaModeracao> {
        self.exigir_moderacao(token).await?;
        self.repositorio.desbanir(conta_id).await?;
        self.avisar_relay(AvisoDeModeracao::Desbanir(conta_id)).await;
        Ok(())
    }

    /// O banimento já está no banco: se o relay não responder, ele vale na próxima conexão da pessoa.
    async fn avisar_relay(&self, aviso: AvisoDeModeracao) {
        if let Err(falha) = self.relay.avisar(aviso).await {
            tracing::warn!(%falha, "não consegui avisar o relay da moderação");
        }
    }

    async fn exigir_moderacao(&self, token: &str) -> Result<Uuid, ErroDaModeracao> {
        let conta = self.conta.conta_da_sessao(token).await.map_err(|_| ErroDaModeracao::SessaoInvalida)?;
        if self.repositorio.situacao(conta.id).await?.admin {
            Ok(conta.id)
        } else {
            Err(ErroDaModeracao::SoAModeracao)
        }
    }
}

/// Fakes das portas, para os testes daqui e os de integração (feature `testes`).
#[cfg(any(test, feature = "testes"))]
pub mod fakes {
    use std::collections::{HashMap, HashSet};
    use std::sync::Mutex;

    use async_trait::async_trait;
    use chrono::{DateTime, Utc};

    use super::*;

    #[derive(Default)]
    pub struct ModeracaoEmMemoria {
        pub moderacao: Mutex<HashSet<Uuid>>,
        pub banidos: Mutex<HashMap<Uuid, String>>,
        pub denuncias: Mutex<Vec<Denuncia>>,
        /// As contas que existem, com o nome.
        pub contas: Mutex<HashMap<Uuid, String>>,
    }

    #[async_trait]
    impl RepositorioDeModeracao for ModeracaoEmMemoria {
        async fn situacao(&self, conta_id: Uuid) -> Result<Situacao, FalhaExterna> {
            Ok(Situacao {
                admin: self.moderacao.lock().unwrap().contains(&conta_id),
                banido: self.banidos.lock().unwrap().contains_key(&conta_id),
            })
        }
        async fn registrar_denuncia(&self, denuncia: &Denuncia) -> Result<(), FalhaExterna> {
            let mut denuncias = self.denuncias.lock().unwrap();
            if !denuncias
                .iter()
                .any(|d| d.mensagem_n == denuncia.mensagem_n && d.denunciante_id == denuncia.denunciante_id)
            {
                denuncias.push(denuncia.clone());
            }
            Ok(())
        }
        async fn denuncias(&self, limite: u32) -> Result<Vec<DenunciaRecebida>, FalhaExterna> {
            let contas = self.contas.lock().unwrap();
            Ok(self
                .denuncias
                .lock()
                .unwrap()
                .iter()
                .rev()
                .take(limite as usize)
                .map(|d| DenunciaRecebida {
                    denuncia: d.clone(),
                    denunciante_nome: contas.get(&d.denunciante_id).cloned().unwrap_or_default(),
                    criada_em: DateTime::<Utc>::UNIX_EPOCH,
                })
                .collect())
        }
        async fn resolver(&self, mensagem_n: i64) -> Result<(), FalhaExterna> {
            self.denuncias.lock().unwrap().retain(|d| d.mensagem_n != mensagem_n);
            Ok(())
        }
        async fn banir(&self, conta_id: Uuid, _por: Uuid) -> Result<bool, FalhaExterna> {
            let Some(nome) = self.contas.lock().unwrap().get(&conta_id).cloned() else {
                return Ok(false);
            };
            self.banidos.lock().unwrap().insert(conta_id, nome);
            Ok(true)
        }
        async fn desbanir(&self, conta_id: Uuid) -> Result<(), FalhaExterna> {
            self.banidos.lock().unwrap().remove(&conta_id);
            Ok(())
        }
        async fn banidos(&self) -> Result<Vec<Banido>, FalhaExterna> {
            Ok(self
                .banidos
                .lock()
                .unwrap()
                .iter()
                .map(|(id, nome)| Banido {
                    conta_id: *id,
                    nome: nome.clone(),
                })
                .collect())
        }
    }

    #[derive(Default)]
    pub struct RelayFalso {
        pub avisos: Mutex<Vec<AvisoDeModeracao>>,
    }

    #[async_trait]
    impl AvisoAoRelay for RelayFalso {
        async fn avisar(&self, aviso: AvisoDeModeracao) -> Result<(), FalhaExterna> {
            self.avisos.lock().unwrap().push(aviso);
            Ok(())
        }
    }

    pub fn servicos_de_moderacao(conta: ServicosDaConta, segredo: Option<&[u8]>) -> (ServicosDeModeracao, Arc<ModeracaoEmMemoria>, Arc<RelayFalso>) {
        let repositorio = Arc::new(ModeracaoEmMemoria::default());
        let relay = Arc::new(RelayFalso::default());
        let servicos = ServicosDeModeracao {
            repositorio: repositorio.clone(),
            relay: relay.clone(),
            conta,
            segredo: segredo.map(|s| Arc::new(s.to_vec())),
        };
        (servicos, repositorio, relay)
    }
}

#[cfg(test)]
mod tests {
    use chrono::DateTime;

    use super::fakes::servicos_de_moderacao;
    use super::*;
    use crate::modules::conta::fakes::{pedido, servicos};
    use crate::modules::moderacao::dominio::assinar_pedido;

    /// Uma conta logada (a do "bom") e outra só no banco da moderação.
    async fn montar() -> (ServicosDeModeracao, Arc<fakes::ModeracaoEmMemoria>, Arc<fakes::RelayFalso>, String, Uuid) {
        let (conta, _, _) = servicos();
        let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let (moderacao, repositorio, relay) = servicos_de_moderacao(conta, Some(b"s"));
        let outra = Uuid::from_u128(99);
        repositorio.contas.lock().unwrap().insert(outra, "Ana".into());
        repositorio.contas.lock().unwrap().insert(entrada.conta.id, entrada.conta.nome.clone());
        (moderacao, repositorio, relay, entrada.token, outra)
    }

    fn denuncia_de(autor: Uuid, denunciante: Uuid) -> Denuncia {
        Denuncia {
            mensagem_n: 3,
            autor_id: autor,
            autor_nome: "Ana".into(),
            texto: "spam".into(),
            mensagem_em: DateTime::from_timestamp(1_800_000_000, 0).unwrap(),
            denunciante_id: denunciante,
        }
    }

    #[tokio::test]
    async fn quem_nao_e_da_moderacao_nao_modera() {
        let (moderacao, _, relay, token, outra) = montar().await;
        assert!(matches!(moderacao.denuncias(&token).await, Err(ErroDaModeracao::SoAModeracao)));
        assert!(matches!(moderacao.banir(&token, outra).await, Err(ErroDaModeracao::SoAModeracao)));
        assert!(matches!(moderacao.banidos("inventado").await, Err(ErroDaModeracao::SessaoInvalida)));
        assert!(relay.avisos.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn a_moderacao_bane_e_desbane_e_o_relay_fica_sabendo() {
        let (moderacao, repositorio, relay, token, outra) = montar().await;
        let eu = moderacao.conta.conta_da_sessao(&token).await.unwrap().id;
        repositorio.moderacao.lock().unwrap().insert(eu);

        moderacao.banir(&token, outra).await.unwrap();
        assert!(moderacao.situacao(outra).await.unwrap().banido);
        assert_eq!(
            moderacao.banidos(&token).await.unwrap(),
            vec![Banido {
                conta_id: outra,
                nome: "Ana".into()
            }]
        );

        moderacao.desbanir(&token, outra).await.unwrap();
        assert!(!moderacao.situacao(outra).await.unwrap().banido);
        assert_eq!(
            *relay.avisos.lock().unwrap(),
            vec![AvisoDeModeracao::Banir(outra), AvisoDeModeracao::Desbanir(outra)]
        );
    }

    #[tokio::test]
    async fn ninguem_da_moderacao_e_banido_e_conta_inexistente_avisa() {
        let (moderacao, repositorio, _, token, outra) = montar().await;
        let eu = moderacao.conta.conta_da_sessao(&token).await.unwrap().id;
        repositorio.moderacao.lock().unwrap().extend([eu, outra]);
        assert!(matches!(moderacao.banir(&token, outra).await, Err(ErroDaModeracao::ModeracaoNaoEBanida)));
        assert!(matches!(
            moderacao.banir(&token, Uuid::from_u128(5)).await,
            Err(ErroDaModeracao::ContaNaoEncontrada)
        ));
    }

    #[tokio::test]
    async fn so_o_relay_denuncia_e_a_moderacao_ve_e_resolve() {
        let (moderacao, repositorio, _, token, outra) = montar().await;
        let eu = moderacao.conta.conta_da_sessao(&token).await.unwrap().id;
        let agora = moderacao.conta.relogio.agora().timestamp();
        let assinatura = assinar_pedido(b"s", agora, b"corpo");
        assert!(moderacao.conferir_relay(agora, &assinatura, b"corpo").is_ok());
        assert!(matches!(
            moderacao.conferir_relay(agora, "falsa", b"corpo"),
            Err(ErroDaModeracao::AssinaturaInvalida)
        ));

        moderacao.registrar_denuncia(denuncia_de(outra, eu)).await.unwrap();
        moderacao.registrar_denuncia(denuncia_de(outra, eu)).await.unwrap();
        repositorio.moderacao.lock().unwrap().insert(eu);
        assert_eq!(moderacao.denuncias(&token).await.unwrap().len(), 1);
        moderacao.resolver(&token, 3).await.unwrap();
        assert!(moderacao.denuncias(&token).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn sem_segredo_ninguem_denuncia() {
        let (conta, _, _) = servicos();
        let (moderacao, _, _) = servicos_de_moderacao(conta, None);
        assert!(matches!(moderacao.conferir_relay(0, "x", b""), Err(ErroDaModeracao::Desligada)));
    }
}
