use chrono::{DateTime, Duration, Utc};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::modules::progresso::{nivel_do_xp, Nivel};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Conta {
    pub id: Uuid,
    pub nome: String,
    pub avatar: Option<String>,
    pub xp_total: u64,
}

impl Conta {
    pub fn nivel(&self) -> Nivel {
        nivel_do_xp(self.xp_total)
    }
}

/// O que o Google diz sobre quem entrou. O `sub` é o id fixo da pessoa no Google.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PerfilDoGoogle {
    pub sub: String,
    pub nome: String,
    pub avatar: Option<String>,
}

pub const DURACAO_DA_SESSAO: Duration = Duration::days(30);
/// Uma música leva bem mais que isso; partidas mais próximas são repetição do mesmo envio ou trapaça.
pub const INTERVALO_MINIMO_ENTRE_PARTIDAS: Duration = Duration::seconds(30);
pub const TAMANHO_MAXIMO_DO_ID_DA_MUSICA: usize = 200;

/// O banco guarda só o hash: quem lê o banco não consegue se passar por ninguém.
pub fn hash_do_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

pub fn pode_registrar(ultima_partida: Option<DateTime<Utc>>, agora: DateTime<Utc>) -> bool {
    ultima_partida.is_none_or(|ultima| agora - ultima >= INTERVALO_MINIMO_ENTRE_PARTIDAS)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn o_hash_e_fixo_e_nao_revela_o_token() {
        let hash = hash_do_token("abc");
        assert_eq!(hash, hash_do_token("abc"));
        assert_ne!(hash, "abc");
        assert_eq!(hash.len(), 64);
    }

    #[test]
    fn so_registra_partidas_espacadas() {
        let agora = Utc::now();
        assert!(pode_registrar(None, agora));
        assert!(!pode_registrar(Some(agora - Duration::seconds(5)), agora));
        assert!(pode_registrar(Some(agora - INTERVALO_MINIMO_ENTRE_PARTIDAS), agora));
    }

    #[test]
    fn o_nivel_sai_do_xp_da_conta() {
        let conta = Conta {
            id: Uuid::nil(),
            nome: "Lucas".into(),
            avatar: None,
            xp_total: 100,
        };
        assert_eq!(conta.nivel().nivel, 2);
    }
}
