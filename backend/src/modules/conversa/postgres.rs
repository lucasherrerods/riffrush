use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::cifra::CifraDasMensagens;
use super::dominio::{MensagemPrivada, NaoLidas, NovaMensagem};
use super::portas::RepositorioDeConversas;
use crate::modules::conta::FalhaExterna;

/// Guarda o texto cifrado; quem lê pela porta recebe o texto aberto.
pub struct ConversasPostgres {
    banco: PgPool,
    cifra: Arc<CifraDasMensagens>,
}

/// Quantas mensagens antigas são cifradas por vez, ao subir.
const LOTE_PARA_CIFRAR: i64 = 500;

fn falha(erro: sqlx::Error) -> FalhaExterna {
    FalhaExterna(erro.to_string())
}

#[derive(FromRow)]
struct LinhaDaMensagem {
    id: i64,
    de: Uuid,
    para: Uuid,
    texto: Option<String>,
    texto_cifrado: Option<Vec<u8>>,
    enviada_em: DateTime<Utc>,
}

#[derive(FromRow)]
struct LinhaSemCifra {
    id: i64,
    texto: String,
}

#[derive(FromRow)]
struct LinhaDasNaoLidas {
    de: Uuid,
    quantas: i64,
}

const GUARDAR: &str =
    "INSERT INTO mensagens_privadas (de, para, texto_cifrado, enviada_em) VALUES ($1, $2, $3, $4) RETURNING id, de, para, texto, texto_cifrado, enviada_em";

const MENSAGENS: &str = "SELECT id, de, para, texto, texto_cifrado, enviada_em FROM mensagens_privadas
    WHERE LEAST(de, para) = LEAST($1::uuid, $2::uuid) AND GREATEST(de, para) = GREATEST($1::uuid, $2::uuid)
      AND ($3::bigint IS NULL OR id < $3)
    ORDER BY id DESC LIMIT $4";

const MARCAR_LIDAS: &str = "UPDATE mensagens_privadas SET lida_em = $3 WHERE para = $1 AND de = $2 AND lida_em IS NULL";

const NAO_LIDAS: &str = "SELECT de, COUNT(*) AS quantas FROM mensagens_privadas WHERE para = $1 AND lida_em IS NULL GROUP BY de";

const SEM_CIFRA: &str = "SELECT id, texto FROM mensagens_privadas WHERE texto_cifrado IS NULL ORDER BY id LIMIT $1";

const CIFRAR: &str = "UPDATE mensagens_privadas m SET texto_cifrado = c.cifrado, texto = NULL
    FROM UNNEST($1::bigint[], $2::bytea[]) AS c(id, cifrado) WHERE m.id = c.id";

impl ConversasPostgres {
    pub fn nova(banco: PgPool, cifra: Arc<CifraDasMensagens>) -> Self {
        Self { banco, cifra }
    }

    fn abrir(&self, l: LinhaDaMensagem) -> Result<MensagemPrivada, FalhaExterna> {
        let texto = match (l.texto_cifrado, l.texto) {
            (Some(cifrado), _) => self.cifra.decifrar(&cifrado).map_err(|e| FalhaExterna(e.to_string()))?,
            // Mensagem de antes da cifra que ainda não passou por `cifrar_as_antigas`.
            (None, Some(texto)) => texto,
            (None, None) => return Err(FalhaExterna("mensagem sem texto".into())),
        };
        Ok(MensagemPrivada {
            id: l.id,
            de: l.de,
            para: l.para,
            texto,
            enviada_em: l.enviada_em,
        })
    }

    /// Cifra as mensagens guardadas antes da cifra e apaga o texto aberto delas. Devolve quantas cifrou.
    pub async fn cifrar_as_antigas(&self) -> Result<u64, FalhaExterna> {
        let mut total = 0;
        loop {
            let linhas: Vec<LinhaSemCifra> = sqlx::query_as(SEM_CIFRA).bind(LOTE_PARA_CIFRAR).fetch_all(&self.banco).await.map_err(falha)?;
            if linhas.is_empty() {
                return Ok(total);
            }
            let ids: Vec<i64> = linhas.iter().map(|l| l.id).collect();
            let cifrados: Vec<Vec<u8>> = linhas.iter().map(|l| self.cifra.cifrar(&l.texto)).collect();
            sqlx::query(CIFRAR).bind(&ids).bind(&cifrados).execute(&self.banco).await.map_err(falha)?;
            total += linhas.len() as u64;
        }
    }
}

#[async_trait]
impl RepositorioDeConversas for ConversasPostgres {
    async fn guardar(&self, m: &NovaMensagem) -> Result<MensagemPrivada, FalhaExterna> {
        let linha: LinhaDaMensagem = sqlx::query_as(GUARDAR)
            .bind(m.de)
            .bind(m.para)
            .bind(self.cifra.cifrar(&m.texto))
            .bind(m.enviada_em)
            .fetch_one(&self.banco)
            .await
            .map_err(falha)?;
        self.abrir(linha)
    }

    async fn mensagens(&self, a: Uuid, b: Uuid, antes: Option<i64>, limite: u32) -> Result<Vec<MensagemPrivada>, FalhaExterna> {
        let linhas: Vec<LinhaDaMensagem> = sqlx::query_as(MENSAGENS)
            .bind(a)
            .bind(b)
            .bind(antes)
            .bind(limite as i64)
            .fetch_all(&self.banco)
            .await
            .map_err(falha)?;
        linhas.into_iter().map(|l| self.abrir(l)).collect()
    }

    async fn marcar_lidas(&self, quem: Uuid, de: Uuid, agora: DateTime<Utc>) -> Result<(), FalhaExterna> {
        sqlx::query(MARCAR_LIDAS)
            .bind(quem)
            .bind(de)
            .bind(agora)
            .execute(&self.banco)
            .await
            .map_err(falha)?;
        Ok(())
    }

    async fn nao_lidas(&self, quem: Uuid) -> Result<Vec<NaoLidas>, FalhaExterna> {
        let linhas: Vec<LinhaDasNaoLidas> = sqlx::query_as(NAO_LIDAS).bind(quem).fetch_all(&self.banco).await.map_err(falha)?;
        Ok(linhas
            .into_iter()
            .map(|l| NaoLidas {
                de: l.de,
                quantas: l.quantas as u32,
            })
            .collect())
    }
}
