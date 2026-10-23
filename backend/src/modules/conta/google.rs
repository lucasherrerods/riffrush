use async_trait::async_trait;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::Deserialize;

use super::dominio::PerfilDoGoogle;
use super::portas::{ErroDeLogin, FalhaExterna, PedidoDeLogin, ProvedorDeLogin};

const ENDERECO_DO_TOKEN: &str = "https://oauth2.googleapis.com/token";

pub struct Google {
    pub client_id: String,
    pub client_secret: String,
    pub http: reqwest::Client,
}

#[derive(Deserialize)]
struct RespostaDoToken {
    id_token: String,
}

#[derive(Deserialize)]
struct Declaracoes {
    sub: String,
    aud: String,
    name: Option<String>,
    picture: Option<String>,
}

/// Lê o perfil de dentro do id_token. A assinatura não precisa ser conferida porque o token
/// veio direto do Google, por HTTPS e com o nosso segredo; o `aud` ainda confirma que é nosso.
fn perfil_do_id_token(id_token: &str, client_id: &str) -> Option<PerfilDoGoogle> {
    let corpo = id_token.split('.').nth(1)?;
    let declaracoes: Declaracoes = serde_json::from_slice(&URL_SAFE_NO_PAD.decode(corpo).ok()?).ok()?;
    (declaracoes.aud == client_id).then(|| PerfilDoGoogle {
        nome: declaracoes.name.unwrap_or_else(|| "Jogador".into()),
        sub: declaracoes.sub,
        avatar: declaracoes.picture,
    })
}

#[async_trait]
impl ProvedorDeLogin for Google {
    async fn trocar_codigo(&self, pedido: &PedidoDeLogin) -> Result<PerfilDoGoogle, ErroDeLogin> {
        let resposta = self
            .http
            .post(ENDERECO_DO_TOKEN)
            .form(&[
                ("code", pedido.codigo.as_str()),
                ("code_verifier", pedido.verificador.as_str()),
                ("redirect_uri", pedido.redirect_uri.as_str()),
                ("client_id", self.client_id.as_str()),
                ("client_secret", self.client_secret.as_str()),
                ("grant_type", "authorization_code"),
            ])
            .send()
            .await
            .map_err(|e| FalhaExterna(format!("google: {e}")))?;
        if resposta.status().is_client_error() {
            return Err(ErroDeLogin::Recusado);
        }
        let token: RespostaDoToken = resposta
            .error_for_status()
            .map_err(|e| FalhaExterna(format!("google: {e}")))?
            .json()
            .await
            .map_err(|e| FalhaExterna(format!("google: {e}")))?;
        perfil_do_id_token(&token.id_token, &self.client_id).ok_or(ErroDeLogin::Recusado)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn id_token(corpo: serde_json::Value) -> String {
        format!("cabecalho.{}.assinatura", URL_SAFE_NO_PAD.encode(corpo.to_string()))
    }

    #[test]
    fn le_o_perfil_do_token() {
        let token = id_token(serde_json::json!({ "sub": "123", "aud": "nosso", "name": "Lucas", "picture": "http://foto" }));
        assert_eq!(
            perfil_do_id_token(&token, "nosso"),
            Some(PerfilDoGoogle {
                sub: "123".into(),
                nome: "Lucas".into(),
                avatar: Some("http://foto".into())
            })
        );
    }

    #[test]
    fn recusa_token_de_outro_app() {
        let token = id_token(serde_json::json!({ "sub": "123", "aud": "outro" }));
        assert_eq!(perfil_do_id_token(&token, "nosso"), None);
    }

    #[test]
    fn sem_nome_usa_um_padrao() {
        let token = id_token(serde_json::json!({ "sub": "123", "aud": "nosso" }));
        assert_eq!(perfil_do_id_token(&token, "nosso").unwrap().nome, "Jogador");
    }

    #[test]
    fn token_quebrado_nao_passa() {
        assert_eq!(perfil_do_id_token("lixo", "nosso"), None);
    }
}
