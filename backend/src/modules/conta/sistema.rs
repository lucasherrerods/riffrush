use chrono::{DateTime, Utc};
use rand::RngCore;
use uuid::Uuid;

use super::portas::{Gerador, Relogio};

pub struct RelogioDoSistema;

impl Relogio for RelogioDoSistema {
    fn agora(&self) -> DateTime<Utc> {
        Utc::now()
    }
}

pub struct GeradorAleatorio;

impl Gerador for GeradorAleatorio {
    fn id(&self) -> Uuid {
        Uuid::new_v4()
    }

    /// 32 bytes do gerador seguro do sistema: impossível de adivinhar.
    fn token(&self) -> String {
        let mut bytes = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut bytes);
        hex::encode(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_sao_longos_e_diferentes() {
        let (a, b) = (GeradorAleatorio.token(), GeradorAleatorio.token());
        assert_eq!(a.len(), 64);
        assert_ne!(a, b);
    }
}
