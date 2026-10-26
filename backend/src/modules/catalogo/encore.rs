use std::sync::Mutex;
use std::time::Duration;

use async_trait::async_trait;
use serde::Deserialize;

use super::dominio::DadosDaMusica;
use super::portas::FonteDeMusicas;
use crate::modules::conta::{FalhaExterna, Relogio};
use crate::modules::rejulgamento::{FonteDeCharts, JanelaDePedidos, JANELA_DO_ENCORE, PEDIDOS_AO_ENCORE};

const ENDERECO_DA_BUSCA: &str = "https://api.enchor.us/search/advanced";
const ENDERECO_DOS_ARQUIVOS: &str = "https://files.enchor.us";
/// O ranking espera esta consulta: melhor ficar sem o nome do que travar a tela.
const TEMPO_MAXIMO: Duration = Duration::from_secs(5);
/// O .sng vem com o áudio: alguns MB que levam um tempo.
const TEMPO_MAXIMO_DO_DOWNLOAD: Duration = Duration::from_secs(120);
/// A versão sem vídeo de um chart fica bem abaixo disso; acima, é algo estranho.
const TAMANHO_MAXIMO_DO_SNG: usize = 200 * 1024 * 1024;

/// O Encore (enchor.us), o mesmo que o app usa para baixar músicas. Os pedidos da busca e
/// dos downloads dividem o mesmo limite, porque o Encore conta todos juntos.
pub struct Encore {
    http: reqwest::Client,
    relogio: std::sync::Arc<dyn Relogio>,
    pedidos: Mutex<JanelaDePedidos>,
}

impl Encore {
    pub fn novo(http: reqwest::Client, relogio: std::sync::Arc<dyn Relogio>) -> Self {
        Self {
            http,
            relogio,
            pedidos: Mutex::new(JanelaDePedidos::nova(PEDIDOS_AO_ENCORE, JANELA_DO_ENCORE)),
        }
    }

    fn pedir(&self) -> Result<(), FalhaExterna> {
        let cabe = self
            .pedidos
            .lock()
            .map_err(|_| FalhaExterna("encore: limite travado".into()))?
            .pedir(self.relogio.agora());
        if cabe {
            Ok(())
        } else {
            Err(FalhaExterna("encore: limite de pedidos".into()))
        }
    }

    async fn buscar(&self, md5: &str) -> Result<Resposta, FalhaExterna> {
        self.pedir()?;
        let falha = |e: reqwest::Error| FalhaExterna(format!("encore: {e}"));
        self.http
            .post(ENDERECO_DA_BUSCA)
            .timeout(TEMPO_MAXIMO)
            .json(&serde_json::json!({ "hash": md5, "page": 1 }))
            .send()
            .await
            .map_err(falha)?
            .error_for_status()
            .map_err(falha)?
            .json()
            .await
            .map_err(falha)
    }
}

#[derive(Deserialize)]
struct Resposta {
    data: Vec<Chart>,
}

#[derive(Deserialize)]
struct Chart {
    md5: String,
    name: Option<String>,
    artist: Option<String>,
    #[serde(rename = "albumArtMd5")]
    album_art_md5: Option<String>,
    #[serde(rename = "encoderVersion", default)]
    versao_do_encoder: Option<u32>,
    #[serde(rename = "hasVideoBackground", default)]
    tem_video: Option<bool>,
}

/// Onde o .sng fica, pela mesma regra do app (`montarUrlDoChart`): os novos numa pasta por versão
/// do encoder, e a versão sem vídeo, que é bem menor, quando o chart tem vídeo.
fn endereco_do_sng(resposta: &Resposta, md5: &str) -> Option<String> {
    let chart = resposta.data.iter().find(|c| c.md5.eq_ignore_ascii_case(md5))?;
    let pasta = match chart.versao_do_encoder {
        Some(versao) if versao > 0 => format!("charts/v{versao}/"),
        _ => String::new(),
    };
    let sem_video = if chart.tem_video == Some(true) { "_novideo" } else { "" };
    Some(format!("{ENDERECO_DOS_ARQUIVOS}/{pasta}{}{sem_video}.sng", chart.md5))
}

fn sem_vazio(texto: Option<String>) -> Option<String> {
    texto.map(|t| t.trim().to_string()).filter(|t| !t.is_empty())
}

/// Escolhe o chart com o md5 pedido e o transforma nos nossos dados.
fn dados_da_resposta(resposta: Resposta, md5: &str) -> Option<DadosDaMusica> {
    let chart = resposta.data.into_iter().find(|c| c.md5.eq_ignore_ascii_case(md5))?;
    let capa = chart
        .album_art_md5
        .filter(|capa| capa.len() == 32 && capa.bytes().all(|b| b.is_ascii_hexdigit()))
        .map(|capa| format!("{ENDERECO_DOS_ARQUIVOS}/{capa}.jpg"));
    Some(DadosDaMusica {
        titulo: sem_vazio(chart.name),
        artista: sem_vazio(chart.artist),
        capa,
    })
}

#[async_trait]
impl FonteDeMusicas for Encore {
    async fn por_md5(&self, md5: &str) -> Result<Option<DadosDaMusica>, FalhaExterna> {
        Ok(dados_da_resposta(self.buscar(md5).await?, md5))
    }
}

#[async_trait]
impl FonteDeCharts for Encore {
    async fn baixar(&self, md5: &str) -> Result<Option<Vec<u8>>, FalhaExterna> {
        let Some(endereco) = endereco_do_sng(&self.buscar(md5).await?, md5) else {
            return Ok(None);
        };
        self.pedir()?;
        let falha = |e: reqwest::Error| FalhaExterna(format!("encore: {e}"));
        let mut resposta = self.http.get(endereco).timeout(TEMPO_MAXIMO_DO_DOWNLOAD).send().await.map_err(falha)?;
        if resposta.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        resposta = resposta.error_for_status().map_err(falha)?;
        let mut sng = Vec::new();
        while let Some(pedaco) = resposta.chunk().await.map_err(falha)? {
            if sng.len() + pedaco.len() > TAMANHO_MAXIMO_DO_SNG {
                return Err(FalhaExterna("encore: .sng grande demais".into()));
            }
            sng.extend_from_slice(&pedaco);
        }
        Ok(Some(sng))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn resposta(json: serde_json::Value) -> Resposta {
        serde_json::from_value(json).unwrap()
    }

    #[test]
    fn le_nome_banda_e_capa_do_chart_com_o_md5_pedido() {
        let json = serde_json::json!({ "data": [
            { "md5": "outro", "name": "Errada", "artist": "X", "albumArtMd5": null },
            { "md5": "FB0079D4C2E025D5B8DD70724750A923", "name": "Goofy Goober Rock", "artist": "Tom Rothrock with Jim Wise",
              "albumArtMd5": "7e6782a90237539d1d61125b1354ab3d", "charter": "Lazarus" }
        ]});
        assert_eq!(
            dados_da_resposta(resposta(json), "fb0079d4c2e025d5b8dd70724750a923"),
            Some(DadosDaMusica {
                titulo: Some("Goofy Goober Rock".into()),
                artista: Some("Tom Rothrock with Jim Wise".into()),
                capa: Some("https://files.enchor.us/7e6782a90237539d1d61125b1354ab3d.jpg".into()),
            })
        );
    }

    #[test]
    fn monta_o_endereco_do_sng_como_o_app() {
        let json = serde_json::json!({ "data": [
            { "md5": "AAAA", "encoderVersion": 3, "hasVideoBackground": true },
            { "md5": "bbbb", "encoderVersion": null, "hasVideoBackground": false }
        ]});
        let resposta = resposta(json);
        assert_eq!(
            endereco_do_sng(&resposta, "aaaa").as_deref(),
            Some("https://files.enchor.us/charts/v3/AAAA_novideo.sng")
        );
        assert_eq!(endereco_do_sng(&resposta, "bbbb").as_deref(), Some("https://files.enchor.us/bbbb.sng"));
        assert_eq!(endereco_do_sng(&resposta, "cccc"), None);
    }

    #[test]
    fn sem_o_chart_ou_com_capa_estranha() {
        assert_eq!(dados_da_resposta(resposta(serde_json::json!({ "data": [] })), "abc"), None);
        let json = serde_json::json!({ "data": [{ "md5": "abc", "name": " ", "artist": null, "albumArtMd5": "../x" }] });
        assert_eq!(dados_da_resposta(resposta(json), "abc"), Some(DadosDaMusica::default()));
    }
}
