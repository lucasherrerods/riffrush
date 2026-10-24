#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Situacao {
    Ok,
    SemBanco,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Saude {
    pub situacao: Situacao,
    pub banco_ok: bool,
}

/// Sem banco a API não atende nada de útil, então ela se declara fora do ar.
pub fn avaliar(banco_ok: bool) -> Saude {
    let situacao = if banco_ok { Situacao::Ok } else { Situacao::SemBanco };
    Saude { situacao, banco_ok }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn com_banco_esta_ok() {
        assert_eq!(avaliar(true).situacao, Situacao::Ok);
    }

    #[test]
    fn sem_banco_fica_fora_do_ar() {
        assert_eq!(
            avaliar(false),
            Saude {
                situacao: Situacao::SemBanco,
                banco_ok: false
            }
        );
    }
}
