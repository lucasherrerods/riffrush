//! O osu! oficial, só para o servidor conferir as partidas: o status e as estrelas pela API v2 (com um token do
//! próprio app, que nunca vai para o cliente) e o .osu pelo endereço público. O áudio nunca passa por aqui.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use serde::Deserialize;

use super::portas::{BeatmapBaixado, BeatmapDoOsu, FonteDeBeatmaps};
use crate::modules::conta::FalhaExterna;

const URL_DO_OSU: &str = "https://osu.ppy.sh";
const MODO_MANIA: u8 = 3;
/// Renova o token um pouco antes de ele vencer.
const FOLGA_DO_TOKEN: Duration = Duration::from_secs(60);

#[derive(Debug, Clone)]
pub struct CredenciaisDoOsu {
    pub client_id: String,
    pub client_secret: String,
}

pub struct Osu {
    pub http: reqwest::Client,
    /// Sem credenciais, nenhuma partida é conferida: elas esperam na fila até a API ser configurada.
    pub credenciais: Option<CredenciaisDoOsu>,
    pub url: String,
    token: Mutex<Option<(String, Instant)>>,
}

impl Osu {
    pub fn novo(http: reqwest::Client, credenciais: Option<CredenciaisDoOsu>) -> Self {
        Self::com_url(http, credenciais, URL_DO_OSU.into())
    }

    /// Para os testes, que apontam para um servidor de mentira.
    pub fn com_url(http: reqwest::Client, credenciais: Option<CredenciaisDoOsu>, url: String) -> Self {
        Self {
            http,
            credenciais,
            url,
            token: Mutex::new(None),
        }
    }

    async fn token(&self) -> Result<String, FalhaExterna> {
        if let Some((token, vence)) = self.token.lock().map_err(|_| FalhaExterna("token do osu! travado".into()))?.clone() {
            if Instant::now() + FOLGA_DO_TOKEN < vence {
                return Ok(token);
            }
        }
        let credenciais = self
            .credenciais
            .as_ref()
            .ok_or_else(|| FalhaExterna("osu!: sem OSU_CLIENT_ID e OSU_CLIENT_SECRET".into()))?;
        #[derive(Deserialize)]
        struct Resposta {
            access_token: String,
            expires_in: u64,
        }
        let resposta: Resposta = self
            .http
            .post(format!("{}/oauth/token", self.url))
            .form(&[
                ("client_id", credenciais.client_id.as_str()),
                ("client_secret", credenciais.client_secret.as_str()),
                ("grant_type", "client_credentials"),
                ("scope", "public"),
            ])
            .send()
            .await
            .and_then(reqwest::Response::error_for_status)
            .map_err(|e| FalhaExterna(format!("osu! token: {e}")))?
            .json()
            .await
            .map_err(|e| FalhaExterna(format!("osu! token: {e}")))?;
        let vence = Instant::now() + Duration::from_secs(resposta.expires_in);
        *self.token.lock().map_err(|_| FalhaExterna("token do osu! travado".into()))? = Some((resposta.access_token.clone(), vence));
        Ok(resposta.access_token)
    }
}

#[derive(Deserialize)]
struct BeatmapDaApi {
    mode_int: u8,
    status: String,
    difficulty_rating: f64,
    beatmapset_id: Option<u64>,
    checksum: Option<String>,
}

#[async_trait]
impl FonteDeBeatmaps for Osu {
    async fn baixar(&self, beatmap_id: u64) -> Result<BeatmapBaixado, FalhaExterna> {
        let token = self.token().await?;
        let resposta = self
            .http
            .get(format!("{}/api/v2/beatmaps/{beatmap_id}", self.url))
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| FalhaExterna(format!("osu! beatmap: {e}")))?;
        if resposta.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(BeatmapBaixado::NaoExiste);
        }
        let dados: BeatmapDaApi = resposta
            .error_for_status()
            .map_err(|e| FalhaExterna(format!("osu! beatmap: {e}")))?
            .json()
            .await
            .map_err(|e| FalhaExterna(format!("osu! beatmap: {e}")))?;
        if dados.mode_int != MODO_MANIA {
            return Ok(BeatmapBaixado::NaoEhMania);
        }
        let texto = self
            .http
            .get(format!("{}/osu/{beatmap_id}", self.url))
            .send()
            .await
            .and_then(reqwest::Response::error_for_status)
            .map_err(|e| FalhaExterna(format!("osu! .osu: {e}")))?
            .text()
            .await
            .map_err(|e| FalhaExterna(format!("osu! .osu: {e}")))?;
        let md5 = riffrush_motor_mania::hash_do_beatmap(texto.as_bytes());
        // O .osu e a API têm de falar da mesma versão do mapa; se não, tenta de novo mais tarde.
        if dados.checksum.as_deref().is_some_and(|c| c != md5) {
            return Err(FalhaExterna("osu!: o .osu não bate com o checksum da API".into()));
        }
        Ok(BeatmapBaixado::Pronto(BeatmapDoOsu {
            beatmap_id,
            beatmapset_id: dados.beatmapset_id,
            md5,
            status: dados.status,
            estrelas: dados.difficulty_rating,
            texto,
        }))
    }
}
