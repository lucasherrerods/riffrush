use chrono::{DateTime, Duration, Utc};

/// Quantos pedidos uma conta fez desde o início da janela.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Janela {
    pub inicio: DateTime<Utc>,
    pub contagem: u32,
}

/// Janela fixa por conta: devolve se o pedido pode passar e a janela atualizada.
pub fn dentro_do_limite(janela: Option<Janela>, agora: DateTime<Utc>, maximo: u32, duracao: Duration) -> (bool, Janela) {
    match janela {
        Some(j) if agora - j.inicio < duracao => {
            if j.contagem >= maximo {
                (false, j)
            } else {
                (true, Janela { contagem: j.contagem + 1, ..j })
            }
        }
        _ => (true, Janela { inicio: agora, contagem: 1 }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn barra_acima_do_maximo_e_libera_quando_a_janela_vira() {
        let agora = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
        let hora = Duration::hours(1);
        let (_, janela) = dentro_do_limite(None, agora, 2, hora);
        let (passa, janela) = dentro_do_limite(Some(janela), agora, 2, hora);
        assert!(passa);
        assert!(!dentro_do_limite(Some(janela), agora + Duration::minutes(59), 2, hora).0);
        assert!(dentro_do_limite(Some(janela), agora + hora, 2, hora).0);
    }
}
