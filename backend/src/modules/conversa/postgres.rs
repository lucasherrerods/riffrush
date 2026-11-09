use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::dominio::{MensagemPrivada, NaoLidas, NovaMensagem};
use super::portas::RepositorioDeConversas;
use crate::modules::conta::FalhaExterna;

pub struct ConversasPostgres(pub PgPool);

fn falha(erro: sqlx::Error) -> FalhaExterna {
    FalhaExterna(erro.to_string())
}

#[derive(FromRow)]
struct LinhaDaMensagem {
    id: i64,
    de: Uuid,
    para: Uuid,
    texto: String,
    enviada_em: DateTime<Utc>,
}

impl From<LinhaDaMensagem> for MensagemPrivada {
    fn from(l: LinhaDaMensagem) -> Self {
        Self {
            id: l.id,
            de: l.de,
            para: l.para,
            texto: l.texto,
            enviada_em: l.enviada_em,
        }
    }
}

#[derive(FromRow)]
struct LinhaDasNaoLidas {
    de: Uuid,
    quantas: i64,
}

const GUARDAR: &str = "INSERT INTO mensagens_privadas (de, para, texto, enviada_em) VALUES ($1, $2, $3, $4) RETURNING id, de, para, texto, enviada_em";

const MENSAGENS: &str = "SELECT id, de, para, texto, enviada_em FROM mensagens_privadas
    WHERE LEAST(de, para) = LEAST($1::uuid, $2::uuid) AND GREATEST(de, para) = GREATEST($1::uuid, $2::uuid)
      AND ($3::bigint IS NULL OR id < $3)
    ORDER BY id DESC LIMIT $4";

const MARCAR_LIDAS: &str = "UPDATE mensagens_privadas SET lida_em = $3 WHERE para = $1 AND de = $2 AND lida_em IS NULL";

const NAO_LIDAS: &str = "SELECT de, COUNT(*) AS quantas FROM mensagens_privadas WHERE para = $1 AND lida_em IS NULL GROUP BY de";

#[async_trait]
impl RepositorioDeConversas for ConversasPostgres {
    async fn guardar(&self, m: &NovaMensagem) -> Result<MensagemPrivada, FalhaExterna> {
        let linha: LinhaDaMensagem = sqlx::query_as(GUARDAR)
            .bind(m.de)
            .bind(m.para)
            .bind(&m.texto)
            .bind(m.enviada_em)
            .fetch_one(&self.0)
            .await
            .map_err(falha)?;
        Ok(linha.into())
    }

    async fn mensagens(&self, a: Uuid, b: Uuid, antes: Option<i64>, limite: u32) -> Result<Vec<MensagemPrivada>, FalhaExterna> {
        let linhas: Vec<LinhaDaMensagem> = sqlx::query_as(MENSAGENS)
            .bind(a)
            .bind(b)
            .bind(antes)
            .bind(limite as i64)
            .fetch_all(&self.0)
            .await
            .map_err(falha)?;
        Ok(linhas.into_iter().map(Into::into).collect())
    }

    async fn marcar_lidas(&self, quem: Uuid, de: Uuid, agora: DateTime<Utc>) -> Result<(), FalhaExterna> {
        sqlx::query(MARCAR_LIDAS)
            .bind(quem)
            .bind(de)
            .bind(agora)
            .execute(&self.0)
            .await
            .map_err(falha)?;
        Ok(())
    }

    async fn nao_lidas(&self, quem: Uuid) -> Result<Vec<NaoLidas>, FalhaExterna> {
        let linhas: Vec<LinhaDasNaoLidas> = sqlx::query_as(NAO_LIDAS).bind(quem).fetch_all(&self.0).await.map_err(falha)?;
        Ok(linhas
            .into_iter()
            .map(|l| NaoLidas {
                de: l.de,
                quantas: l.quantas as u32,
            })
            .collect())
    }
}
