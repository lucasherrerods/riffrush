//! Login do Google no desktop. O Google não deixa entrar dentro da webview, então o app abre
//! o navegador do sistema e espera a volta num servidor de uma requisição só, em 127.0.0.1.

use std::process::Command;
use std::time::Duration;

use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const INICIO_DO_LOGIN: &str = "https://accounts.google.com/o/oauth2/v2/auth?";
/// Tempo para a pessoa escolher a conta no navegador.
const ESPERA_MAXIMA: Duration = Duration::from_secs(300);
const TAMANHO_MAXIMO_DO_PEDIDO: usize = 8 * 1024;

/// O navegador só deixa o script fechar a aba em alguns casos. Quando não deixa, a página
/// continua aberta e troca a mensagem.
const PAGINA_DE_VOLTA: &str ="<!doctype html><meta charset=utf-8><title>Riff Rush</title>\
<body style=\"background:#141118;color:#f4f1f7;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0\">\
<p id=m>Login feito! Voltando para o Riff Rush...</p>\
<script>setTimeout(function(){window.close();setTimeout(function(){\
document.getElementById('m').textContent='Login feito! Pode fechar esta aba: o Riff Rush já está aberto.'},300)},800)</script>";

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RetornoDoLogin {
    /// A busca da URL de volta (`?code=...&state=...`), lida pelo mesmo código da versão web.
    busca: String,
    redirect_uri: String,
}

/// Só abre o endereço de login do Google: o comando não vira um jeito de abrir qualquer coisa.
fn url_do_google_valida(url: &str) -> bool {
    url.starts_with(INICIO_DO_LOGIN) && !url.contains(['"', '\'', ' ', '\n', '\r'])
}

fn com_redirect(url: &str, redirect_uri: &str) -> String {
    let codificado: String = redirect_uri
        .chars()
        .map(|c| match c {
            ':' => "%3A".to_string(),
            '/' => "%2F".to_string(),
            c => c.to_string(),
        })
        .collect();
    format!("{url}&redirect_uri={codificado}")
}

/// A busca da primeira linha do pedido HTTP: `GET /?code=a&state=b HTTP/1.1` → `?code=a&state=b`.
fn busca_do_pedido(pedido: &str) -> Option<String> {
    let caminho = pedido.lines().next()?.strip_prefix("GET ")?.split(' ').next()?;
    let busca = caminho.strip_prefix('/')?;
    busca.starts_with('?').then(|| busca.to_string())
}

fn abrir_no_navegador(url: &str) -> std::io::Result<()> {
    #[cfg(target_os = "windows")]
    let mut comando = {
        let mut c = Command::new("rundll32");
        c.args(["url.dll,FileProtocolHandler", url]);
        c
    };
    #[cfg(target_os = "macos")]
    let mut comando = {
        let mut c = Command::new("open");
        c.arg(url);
        c
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut comando = {
        let mut c = Command::new("xdg-open");
        c.arg(url);
        c
    };
    comando.spawn().map(|_| ())
}

async fn esperar_a_volta(ouvinte: TcpListener) -> Result<String, String> {
    loop {
        let (mut conexao, _) = ouvinte.accept().await.map_err(|e| e.to_string())?;
        let mut pedido = Vec::new();
        let mut pedaco = [0u8; 1024];
        while !pedido.windows(4).any(|j| j == b"\r\n\r\n") && pedido.len() < TAMANHO_MAXIMO_DO_PEDIDO {
            let lidos = conexao.read(&mut pedaco).await.map_err(|e| e.to_string())?;
            if lidos == 0 {
                break;
            }
            pedido.extend_from_slice(&pedaco[..lidos]);
        }
        // O navegador às vezes pede o favicon antes; só a volta do Google tem a busca.
        let Some(busca) = busca_do_pedido(&String::from_utf8_lossy(&pedido)) else {
            let _ = conexao.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n").await;
            continue;
        };
        let resposta = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{PAGINA_DE_VOLTA}",
            PAGINA_DE_VOLTA.len()
        );
        let _ = conexao.write_all(resposta.as_bytes()).await;
        return Ok(busca);
    }
}

/// Traz a janela do jogo para a frente do navegador. No Windows, só o foco não basta para passar
/// na frente de outro programa: ficar por cima por um instante resolve.
fn trazer_para_frente(janela: &tauri::WebviewWindow) {
    let _ = janela.unminimize();
    let _ = janela.show();
    let _ = janela.set_always_on_top(true);
    let _ = janela.set_focus();
    let _ = janela.set_always_on_top(false);
}

/// Abre o login no navegador e devolve a volta do Google. `url` é a URL de login sem o redirect.
#[tauri::command]
pub async fn login_pelo_navegador(janela: tauri::WebviewWindow, url: String) -> Result<RetornoDoLogin, String> {
    if !url_do_google_valida(&url) {
        return Err("Endereço de login inválido.".into());
    }
    let ouvinte = TcpListener::bind("127.0.0.1:0").await.map_err(|e| e.to_string())?;
    let porta = ouvinte.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{porta}/");
    abrir_no_navegador(&com_redirect(&url, &redirect_uri)).map_err(|e| format!("Não deu para abrir o navegador: {e}"))?;
    let busca = tokio::time::timeout(ESPERA_MAXIMA, esperar_a_volta(ouvinte))
        .await
        .map_err(|_| "O login demorou demais. Tente de novo.".to_string())??;
    trazer_para_frente(&janela);
    Ok(RetornoDoLogin { busca, redirect_uri })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn so_aceita_o_login_do_google() {
        assert!(url_do_google_valida("https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=y"));
        assert!(!url_do_google_valida("https://malicioso.com/?https://accounts.google.com"));
        assert!(!url_do_google_valida("file:///C:/Windows/System32/calc.exe"));
        assert!(!url_do_google_valida("https://accounts.google.com/o/oauth2/v2/auth?x=\" & calc"));
    }

    #[test]
    fn junta_o_redirect_codificado() {
        assert_eq!(
            com_redirect("https://accounts.google.com/o/oauth2/v2/auth?a=1", "http://127.0.0.1:5000/"),
            "https://accounts.google.com/o/oauth2/v2/auth?a=1&redirect_uri=http%3A%2F%2F127.0.0.1%3A5000%2F"
        );
    }

    #[test]
    fn le_a_busca_da_volta_do_google() {
        assert_eq!(busca_do_pedido("GET /?code=abc&state=e HTTP/1.1\r\nHost: x\r\n\r\n"), Some("?code=abc&state=e".into()));
    }

    #[test]
    fn ignora_outros_pedidos() {
        assert_eq!(busca_do_pedido("GET /favicon.ico HTTP/1.1\r\n\r\n"), None);
        assert_eq!(busca_do_pedido("POST /?code=a HTTP/1.1\r\n\r\n"), None);
        assert_eq!(busca_do_pedido(""), None);
    }

    #[tokio::test]
    async fn responde_ao_navegador_e_devolve_a_busca() {
        let ouvinte = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endereco = ouvinte.local_addr().unwrap();
        let espera = tokio::spawn(esperar_a_volta(ouvinte));

        let mut favicon = tokio::net::TcpStream::connect(endereco).await.unwrap();
        favicon.write_all(b"GET /favicon.ico HTTP/1.1\r\n\r\n").await.unwrap();
        let mut resposta = String::new();
        favicon.read_to_string(&mut resposta).await.unwrap();
        assert!(resposta.starts_with("HTTP/1.1 404"));

        let mut navegador = tokio::net::TcpStream::connect(endereco).await.unwrap();
        navegador.write_all(b"GET /?code=abc&state=e HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").await.unwrap();
        let mut pagina = String::new();
        navegador.read_to_string(&mut pagina).await.unwrap();
        assert!(pagina.contains("Voltando para o Riff Rush"));
        assert_eq!(espera.await.unwrap(), Ok("?code=abc&state=e".into()));
    }

    #[test]
    fn a_pagina_de_volta_fecha_a_aba_sozinha_e_avisa_se_o_navegador_nao_deixar() {
        assert!(PAGINA_DE_VOLTA.contains("window.close()"));
        assert!(PAGINA_DE_VOLTA.contains("Pode fechar esta aba"));
    }
}
