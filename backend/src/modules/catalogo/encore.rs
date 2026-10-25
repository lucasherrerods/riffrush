use std::time::Duration;

use async_trait::async_trait;
use serde::Deserialize;

use super::dominio::DadosDaMusica;
use super::portas::FonteDeMusicas;
use crate::modules::conta::FalhaExterna;

const ENDERECO_DA_BUSCA: &str = "https://api.enchor.us/search/advanced";
const ENDERECO_DOS_ARQUIVOS: &str = "https://files.enchor.us";
/// O ranking espera esta consulta: melhor ficar sem o nome do que travar a tela.
const TEMPO_MAXIMO: Duration = Duration::from_secs(5);

/// A busca do Encore (enchor.us), a mesma que o app usa para baixar músicas.
pub struct Encore {
    pub http: reqwest::Client,
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
        let falha = |e: reqwest::Error| FalhaExterna(format!("encore: {e}"));
        let resposta: Resposta = self
            .http
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
            .map_err(falha)?;
        Ok(dados_da_resposta(resposta, md5))
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
    fn sem_o_chart_ou_com_capa_estranha() {
        assert_eq!(dados_da_resposta(resposta(serde_json::json!({ "data": [] })), "abc"), None);
        let json = serde_json::json!({ "data": [{ "md5": "abc", "name": " ", "artist": null, "albumArtMd5": "../x" }] });
        assert_eq!(dados_da_resposta(resposta(json), "abc"), Some(DadosDaMusica::default()));
    }
}
