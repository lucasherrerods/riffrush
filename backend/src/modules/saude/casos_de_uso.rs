use super::dominio::{avaliar, Saude};
use super::portas::VerificadorDoBanco;

pub async fn verificar_saude(banco: &dyn VerificadorDoBanco) -> Saude {
    avaliar(banco.responde().await)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::saude::dominio::Situacao;
    use async_trait::async_trait;

    struct BancoFalso(bool);

    #[async_trait]
    impl VerificadorDoBanco for BancoFalso {
        async fn responde(&self) -> bool {
            self.0
        }
    }

    #[tokio::test]
    async fn pergunta_ao_banco_e_avalia() {
        assert_eq!(verificar_saude(&BancoFalso(true)).await.situacao, Situacao::Ok);
        assert_eq!(verificar_saude(&BancoFalso(false)).await.situacao, Situacao::SemBanco);
    }
}
