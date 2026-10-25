use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::dominio::{Banido, Denuncia, DenunciaRecebida, Situacao};
use super::portas::RepositorioDeModeracao;
use crate::modules::conta::FalhaExterna;

pub struct ModeracaoPostgres(pub PgPool);

fn falha(erro: sqlx::Error) -> FalhaExterna {
    FalhaExterna(erro.to_string())
}

#[derive(FromRow)]
struct LinhaDaSituacao {
    admin: bool,
    banido: bool,
}

#[derive(FromRow)]
struct LinhaDaDenuncia {
    mensagem_n: i64,
    autor_id: Uuid,
    autor_nome: String,
    texto: String,
    mensagem_em: DateTime<Utc>,
    denunciante_id: Uuid,
    denunciante_nome: String,
    criada_em: DateTime<Utc>,
}

#[derive(FromRow)]
struct LinhaDoBanido {
    conta_id: Uuid,
    nome: String,
}

const SITUACAO: &str = "
    SELECT EXISTS (SELECT 1 FROM equipe WHERE conta_id = $1) AS admin,
           EXISTS (SELECT 1 FROM banimentos_do_chat WHERE conta_id = $1) AS banido";

const DENUNCIAS: &str = "
    SELECT d.mensagem_n, d.autor_id, d.autor_nome, d.texto, d.mensagem_em, d.denunciante_id, c.nome AS denunciante_nome, d.criada_em
    FROM denuncias_do_chat d JOIN contas c ON c.id = d.denunciante_id
    ORDER BY d.criada_em DESC
    LIMIT $1";

#[async_trait]
impl RepositorioDeModeracao for ModeracaoPostgres {
    async fn situacao(&self, conta_id: Uuid) -> Result<Situacao, FalhaExterna> {
        let linha: LinhaDaSituacao = sqlx::query_as(SITUACAO).bind(conta_id).fetch_one(&self.0).await.map_err(falha)?;
        Ok(Situacao {
            admin: linha.admin,
            banido: linha.banido,
        })
    }

    async fn registrar_denuncia(&self, d: &Denuncia) -> Result<(), FalhaExterna> {
        // Conta que já não existe (excluída) não deixa denúncia para trás: o insert não acha a conta e não grava.
        sqlx::query(
            "INSERT INTO denuncias_do_chat (mensagem_n, autor_id, autor_nome, texto, mensagem_em, denunciante_id)
             SELECT $1, $2, $3, $4, $5, $6
             WHERE EXISTS (SELECT 1 FROM contas WHERE id = $2) AND EXISTS (SELECT 1 FROM contas WHERE id = $6)
             ON CONFLICT (mensagem_n, denunciante_id) DO NOTHING",
        )
        .bind(d.mensagem_n)
        .bind(d.autor_id)
        .bind(&d.autor_nome)
        .bind(&d.texto)
        .bind(d.mensagem_em)
        .bind(d.denunciante_id)
        .execute(&self.0)
        .await
        .map_err(falha)?;
        Ok(())
    }

    async fn denuncias(&self, limite: u32) -> Result<Vec<DenunciaRecebida>, FalhaExterna> {
        let linhas: Vec<LinhaDaDenuncia> = sqlx::query_as(DENUNCIAS).bind(i64::from(limite)).fetch_all(&self.0).await.map_err(falha)?;
        Ok(linhas
            .into_iter()
            .map(|l| DenunciaRecebida {
                denuncia: Denuncia {
                    mensagem_n: l.mensagem_n,
                    autor_id: l.autor_id,
                    autor_nome: l.autor_nome,
                    texto: l.texto,
                    mensagem_em: l.mensagem_em,
                    denunciante_id: l.denunciante_id,
                },
                denunciante_nome: l.denunciante_nome,
                criada_em: l.criada_em,
            })
            .collect())
    }

    async fn resolver(&self, mensagem_n: i64) -> Result<(), FalhaExterna> {
        sqlx::query("DELETE FROM denuncias_do_chat WHERE mensagem_n = $1")
            .bind(mensagem_n)
            .execute(&self.0)
            .await
            .map_err(falha)?;
        Ok(())
    }

    async fn banir(&self, conta_id: Uuid, por: Uuid) -> Result<bool, FalhaExterna> {
        let resultado = sqlx::query(
            "INSERT INTO banimentos_do_chat (conta_id, banido_por)
             SELECT id, $2 FROM contas WHERE id = $1
             ON CONFLICT (conta_id) DO NOTHING",
        )
        .bind(conta_id)
        .bind(por)
        .execute(&self.0)
        .await
        .map_err(falha)?;
        if resultado.rows_affected() > 0 {
            return Ok(true);
        }
        // Já banida também conta como sucesso.
        let existe: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM contas WHERE id = $1)")
            .bind(conta_id)
            .fetch_one(&self.0)
            .await
            .map_err(falha)?;
        Ok(existe)
    }

    async fn desbanir(&self, conta_id: Uuid) -> Result<(), FalhaExterna> {
        sqlx::query("DELETE FROM banimentos_do_chat WHERE conta_id = $1")
            .bind(conta_id)
            .execute(&self.0)
            .await
            .map_err(falha)?;
        Ok(())
    }

    async fn banidos(&self) -> Result<Vec<Banido>, FalhaExterna> {
        let linhas: Vec<LinhaDoBanido> =
            sqlx::query_as("SELECT b.conta_id, c.nome FROM banimentos_do_chat b JOIN contas c ON c.id = b.conta_id ORDER BY b.criado_em DESC")
                .fetch_all(&self.0)
                .await
                .map_err(falha)?;
        Ok(linhas
            .into_iter()
            .map(|l| Banido {
                conta_id: l.conta_id,
                nome: l.nome,
            })
            .collect())
    }
}
