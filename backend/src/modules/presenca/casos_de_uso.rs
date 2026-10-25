use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use chrono::Duration;
use uuid::Uuid;

use super::dominio::{assinar_ficha, dentro_do_limite, Ficha, Janela, VALIDADE_DA_FICHA_EM_SEGUNDOS};
use crate::modules::conta::ServicosDaConta;

#[derive(Clone)]
pub struct ServicosDePresenca {
    /// Para achar a conta pela sessão e ler o relógio.
    pub conta: ServicosDaConta,
    /// O mesmo segredo do relay. Sem ele, a presença fica desligada.
    pub segredo: Option<Arc<Vec<u8>>>,
    /// A janela de fichas de cada conta. Só em memória: reiniciar a API zera, e tudo bem.
    pub janelas: Arc<Mutex<HashMap<Uuid, Janela>>>,
}

/// Acima disso, as janelas vencidas são jogadas fora para o mapa não crescer sem fim.
const JANELAS_GUARDADAS: usize = 10_000;

#[derive(Debug, thiserror::Error)]
pub enum ErroDaPresenca {
    #[error("a presença online está desligada neste servidor")]
    Desligada,
    #[error("sessão inválida ou expirada")]
    SessaoInvalida,
    #[error("fichas demais em pouco tempo")]
    RapidoDemais,
}

impl ServicosDePresenca {
    /// Uma ficha assinada que prova ao relay quem é a pessoa, sem o relay conhecer as sessões.
    pub async fn ficha(&self, token: &str) -> Result<String, ErroDaPresenca> {
        let segredo = self.segredo.as_ref().ok_or(ErroDaPresenca::Desligada)?;
        let conta = self.conta.conta_da_sessao(token).await.map_err(|_| ErroDaPresenca::SessaoInvalida)?;
        let agora = self.conta.relogio.agora();
        {
            let mut janelas = self.janelas.lock().unwrap_or_else(|envenenado| envenenado.into_inner());
            if janelas.len() > JANELAS_GUARDADAS {
                janelas.retain(|_, j| agora - j.inicio < Duration::minutes(1));
            }
            let (passa, janela) = dentro_do_limite(janelas.get(&conta.id).copied(), agora);
            janelas.insert(conta.id, janela);
            if !passa {
                return Err(ErroDaPresenca::RapidoDemais);
            }
        }
        let exp = (agora + Duration::seconds(VALIDADE_DA_FICHA_EM_SEGUNDOS)).timestamp();
        let nivel = conta.nivel().nivel;
        let ficha = Ficha {
            id: conta.id,
            nome: conta.nome,
            avatar: conta.avatar,
            nivel,
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
            janelas: Default::default(),
        };

        let ficha = presenca.ficha(&entrada.token).await.unwrap();

        let corpo = BASE64_URL_SAFE_NO_PAD.decode(ficha.split('.').next().unwrap()).unwrap();
        let corpo: serde_json::Value = serde_json::from_slice(&corpo).unwrap();
        assert_eq!(corpo["id"], entrada.conta.id.to_string());
        assert_eq!(corpo["exp"], relogio.agora().timestamp() + VALIDADE_DA_FICHA_EM_SEGUNDOS);
        assert_eq!(corpo["nivel"], 1);
    }

    #[tokio::test]
    async fn quem_pede_fichas_demais_espera() {
        let (conta, _, _) = servicos();
        let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let presenca = ServicosDePresenca {
            conta,
            segredo: Some(Arc::new(b"s".to_vec())),
            janelas: Default::default(),
        };
        for _ in 0..crate::modules::presenca::FICHAS_POR_MINUTO {
            presenca.ficha(&entrada.token).await.unwrap();
        }
        assert!(matches!(presenca.ficha(&entrada.token).await, Err(ErroDaPresenca::RapidoDemais)));
    }

    #[tokio::test]
    async fn sem_segredo_fica_desligada_e_sem_sessao_recusa() {
        let (conta, _, _) = servicos();
        let desligada = ServicosDePresenca {
            conta: conta.clone(),
            segredo: None,
            janelas: Default::default(),
        };
        assert!(matches!(desligada.ficha("x").await, Err(ErroDaPresenca::Desligada)));
        let ligada = ServicosDePresenca {
            conta,
            segredo: Some(Arc::new(b"s".to_vec())),
            janelas: Default::default(),
        };
        assert!(matches!(ligada.ficha("inventado").await, Err(ErroDaPresenca::SessaoInvalida)));
    }
}
