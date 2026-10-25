use std::sync::Arc;

use chrono::Duration;

use super::dominio::{assinar_ficha, Ficha, VALIDADE_DA_FICHA_EM_SEGUNDOS};
use crate::modules::conta::ServicosDaConta;

#[derive(Clone)]
pub struct ServicosDePresenca {
    /// Para achar a conta pela sessão e ler o relógio.
    pub conta: ServicosDaConta,
    /// O mesmo segredo do relay. Sem ele, a presença fica desligada.
    pub segredo: Option<Arc<Vec<u8>>>,
}

#[derive(Debug, thiserror::Error)]
pub enum ErroDaPresenca {
    #[error("a presença online está desligada neste servidor")]
    Desligada,
    #[error("sessão inválida ou expirada")]
    SessaoInvalida,
}

impl ServicosDePresenca {
    /// Uma ficha assinada que prova ao relay quem é a pessoa, sem o relay conhecer as sessões.
    pub async fn ficha(&self, token: &str) -> Result<String, ErroDaPresenca> {
        let segredo = self.segredo.as_ref().ok_or(ErroDaPresenca::Desligada)?;
        let conta = self.conta.conta_da_sessao(token).await.map_err(|_| ErroDaPresenca::SessaoInvalida)?;
        let exp = (self.conta.relogio.agora() + Duration::seconds(VALIDADE_DA_FICHA_EM_SEGUNDOS)).timestamp();
        let ficha = Ficha {
            id: conta.id,
            nome: conta.nome,
            avatar: conta.avatar,
            exp,
        };
        Ok(assinar_ficha(&ficha, segredo))
    }
}

#[cfg(test)]
mod tests {
    use base64::prelude::{Engine, BASE64_URL_SAFE_NO_PAD};

    use super::*;
    use crate::modules::conta::fakes::{pedido, servicos};
    use crate::modules::conta::Relogio;

    #[tokio::test]
    async fn a_ficha_traz_a_conta_e_vence_em_minutos() {
        let (conta, _, relogio) = servicos();
        let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let presenca = ServicosDePresenca {
            conta,
            segredo: Some(Arc::new(b"segredo".to_vec())),
        };

        let ficha = presenca.ficha(&entrada.token).await.unwrap();

        let corpo = BASE64_URL_SAFE_NO_PAD.decode(ficha.split('.').next().unwrap()).unwrap();
        let corpo: serde_json::Value = serde_json::from_slice(&corpo).unwrap();
        assert_eq!(corpo["id"], entrada.conta.id.to_string());
        assert_eq!(corpo["exp"], relogio.agora().timestamp() + VALIDADE_DA_FICHA_EM_SEGUNDOS);
    }

    #[tokio::test]
    async fn sem_segredo_fica_desligada_e_sem_sessao_recusa() {
        let (conta, _, _) = servicos();
        let desligada = ServicosDePresenca {
            conta: conta.clone(),
            segredo: None,
        };
        assert!(matches!(desligada.ficha("x").await, Err(ErroDaPresenca::Desligada)));
        let ligada = ServicosDePresenca {
            conta,
            segredo: Some(Arc::new(b"s".to_vec())),
        };
        assert!(matches!(ligada.ficha("inventado").await, Err(ErroDaPresenca::SessaoInvalida)));
    }
}
