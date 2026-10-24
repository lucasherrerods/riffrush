use std::net::SocketAddr;

#[derive(Debug, Clone)]
pub struct Config {
    pub endereco: SocketAddr,
    pub url_do_banco: String,
    /// Origens do navegador que podem chamar a API (o app web e o dev server).
    pub origens_permitidas: Vec<String>,
    pub google_client_id: String,
    pub google_client_secret: String,
    /// Client do tipo "App para computador"; opcional, sem ele o login no desktop fica desligado.
    pub google_desktop: Option<(String, String)>,
}

#[derive(Debug, thiserror::Error, PartialEq)]
pub enum ErroDeConfig {
    #[error("a variável {0} é obrigatória")]
    Faltando(&'static str),
    #[error("a variável {0} tem um valor inválido")]
    Invalida(&'static str),
}

impl Config {
    pub fn do_ambiente() -> Result<Self, ErroDeConfig> {
        Self::ler(|nome| std::env::var(nome).ok())
    }

    /// Lê de uma função, para os testes não mexerem nas variáveis do processo.
    pub fn ler(variavel: impl Fn(&str) -> Option<String>) -> Result<Self, ErroDeConfig> {
        let endereco = variavel("ENDERECO")
            .unwrap_or_else(|| "0.0.0.0:8080".into())
            .parse()
            .map_err(|_| ErroDeConfig::Invalida("ENDERECO"))?;
        let url_do_banco = variavel("DATABASE_URL").ok_or(ErroDeConfig::Faltando("DATABASE_URL"))?;
        let origens_permitidas = variavel("ORIGENS_PERMITIDAS")
            .unwrap_or_default()
            .split(',')
            .map(str::trim)
            .filter(|o| !o.is_empty())
            .map(String::from)
            .collect();
        let google_client_id = variavel("GOOGLE_CLIENT_ID").ok_or(ErroDeConfig::Faltando("GOOGLE_CLIENT_ID"))?;
        let google_client_secret = variavel("GOOGLE_CLIENT_SECRET").ok_or(ErroDeConfig::Faltando("GOOGLE_CLIENT_SECRET"))?;
        let google_desktop = variavel("GOOGLE_DESKTOP_CLIENT_ID").zip(variavel("GOOGLE_DESKTOP_CLIENT_SECRET"));
        Ok(Self {
            endereco,
            url_do_banco,
            origens_permitidas,
            google_client_id,
            google_client_secret,
            google_desktop,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn com<'a>(pares: &'a [(&'a str, &'a str)]) -> impl Fn(&str) -> Option<String> + 'a {
        move |nome| pares.iter().find(|(n, _)| *n == nome).map(|(_, v)| v.to_string())
    }

    #[test]
    fn le_o_ambiente_com_padroes() {
        let config = Config::ler(com(&[
            ("DATABASE_URL", "postgres://x"),
            ("GOOGLE_CLIENT_ID", "id"),
            ("GOOGLE_CLIENT_SECRET", "segredo"),
        ]))
        .unwrap();
        assert_eq!(config.endereco.to_string(), "0.0.0.0:8080");
        assert!(config.origens_permitidas.is_empty());
        assert!(config.google_desktop.is_none());
    }

    #[test]
    fn separa_as_origens_por_virgula() {
        let config = Config::ler(com(&[
            ("DATABASE_URL", "postgres://x"),
            ("GOOGLE_CLIENT_ID", "id"),
            ("GOOGLE_CLIENT_SECRET", "segredo"),
            ("ORIGENS_PERMITIDAS", "http://a, http://b,"),
        ]))
        .unwrap();
        assert_eq!(config.origens_permitidas, ["http://a", "http://b"]);
    }

    #[test]
    fn sem_banco_nao_sobe() {
        assert_eq!(Config::ler(com(&[])).unwrap_err(), ErroDeConfig::Faltando("DATABASE_URL"));
    }

    #[test]
    fn sem_credenciais_do_google_nao_sobe() {
        assert_eq!(
            Config::ler(com(&[("DATABASE_URL", "x")])).unwrap_err(),
            ErroDeConfig::Faltando("GOOGLE_CLIENT_ID")
        );
    }

    #[test]
    fn endereco_invalido_e_erro() {
        let erro = Config::ler(com(&[
            ("DATABASE_URL", "x"),
            ("GOOGLE_CLIENT_ID", "id"),
            ("GOOGLE_CLIENT_SECRET", "segredo"),
            ("ENDERECO", "nao"),
        ]))
        .unwrap_err();
        assert_eq!(erro, ErroDeConfig::Invalida("ENDERECO"));
    }
}
