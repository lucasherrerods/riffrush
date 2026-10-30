use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::dominio::{Contagens, Pessoa, Relacao, Sugestao, Vinculo};
use super::portas::RepositorioDeAmizades;
use crate::modules::conta::FalhaExterna;

pub struct AmizadesPostgres(pub PgPool);

fn falha(erro: sqlx::Error) -> FalhaExterna {
    FalhaExterna(erro.to_string())
}

#[derive(FromRow)]
struct LinhaDaRelacao {
    bloqueou: bool,
    foi_bloqueado: bool,
    solicitante: Option<Uuid>,
    aceita: Option<bool>,
}

#[derive(FromRow)]
struct LinhaDasContagens {
    amigos_de_quem_pede: i64,
    enviados_de_quem_pede: i64,
    amigos_do_outro: i64,
}

#[derive(FromRow)]
struct LinhaDaPessoa {
    conta_id: Uuid,
    nome: String,
    avatar: Option<String>,
    xp_total: i64,
    visto_em: Option<DateTime<Utc>>,
    desde: DateTime<Utc>,
    vinculo: String,
}

#[derive(FromRow)]
struct LinhaDaSugestao {
    conta_id: Uuid,
    nome: String,
    avatar: Option<String>,
    xp_total: i64,
    amigos_em_comum: i64,
}

const RELACAO: &str = "
    SELECT EXISTS (SELECT 1 FROM bloqueios WHERE quem = $1 AND bloqueado = $2) AS bloqueou,
           EXISTS (SELECT 1 FROM bloqueios WHERE quem = $2 AND bloqueado = $1) AS foi_bloqueado,
           a.solicitante, a.aceita
    FROM (SELECT 1) AS x
    LEFT JOIN amizades a ON (a.solicitante = $1 AND a.destinatario = $2) OR (a.solicitante = $2 AND a.destinatario = $1)";

const CONTAGENS: &str = "
    SELECT (SELECT count(*) FROM amizades WHERE aceita AND (solicitante = $1 OR destinatario = $1)) AS amigos_de_quem_pede,
           (SELECT count(*) FROM amizades WHERE NOT aceita AND solicitante = $1) AS enviados_de_quem_pede,
           (SELECT count(*) FROM amizades WHERE aceita AND (solicitante = $2 OR destinatario = $2)) AS amigos_do_outro";

const PESSOAS: &str = "
    WITH ligados AS (
        SELECT CASE WHEN solicitante = $1 THEN destinatario ELSE solicitante END AS outro,
               COALESCE(aceita_em, criada_em) AS desde,
               CASE WHEN aceita THEN 'amigo' WHEN solicitante = $1 THEN 'enviado' ELSE 'recebido' END AS vinculo
        FROM amizades WHERE solicitante = $1 OR destinatario = $1
        UNION ALL
        SELECT bloqueado, criado_em, 'bloqueado' FROM bloqueios WHERE quem = $1
    )
    SELECT c.id AS conta_id, c.nome, c.avatar, c.xp_total, f.visto_em, l.desde, l.vinculo
    FROM ligados l
    JOIN contas c ON c.id = l.outro
    LEFT JOIN fichas_de_amizade f ON f.conta_id = c.id
    ORDER BY lower(c.nome)";

const SUGESTOES: &str = "
    WITH meus AS (
        SELECT CASE WHEN solicitante = $1 THEN destinatario ELSE solicitante END AS amigo
        FROM amizades WHERE aceita AND (solicitante = $1 OR destinatario = $1)
    ),
    deles AS (
        SELECT CASE WHEN a.solicitante = m.amigo THEN a.destinatario ELSE a.solicitante END AS candidato
        FROM meus m JOIN amizades a ON a.aceita AND (a.solicitante = m.amigo OR a.destinatario = m.amigo)
    )
    SELECT c.id AS conta_id, c.nome, c.avatar, c.xp_total, count(*) AS amigos_em_comum
    FROM deles d JOIN contas c ON c.id = d.candidato
    WHERE d.candidato <> $1
      AND NOT EXISTS (SELECT 1 FROM amizades a WHERE (a.solicitante = $1 AND a.destinatario = d.candidato) OR (a.solicitante = d.candidato AND a.destinatario = $1))
      AND NOT EXISTS (SELECT 1 FROM bloqueios b WHERE (b.quem = $1 AND b.bloqueado = d.candidato) OR (b.quem = d.candidato AND b.bloqueado = $1))
    GROUP BY c.id, c.nome, c.avatar, c.xp_total
    ORDER BY amigos_em_comum DESC, c.xp_total DESC
    LIMIT $2";

#[async_trait]
impl RepositorioDeAmizades for AmizadesPostgres {
    async fn codigo(&self, conta_id: Uuid) -> Result<Option<String>, FalhaExterna> {
        sqlx::query_scalar("SELECT codigo FROM fichas_de_amizade WHERE conta_id = $1")
            .bind(conta_id)
            .fetch_optional(&self.0)
            .await
            .map_err(falha)
    }

    async fn guardar_codigo(&self, conta_id: Uuid, codigo: &str) -> Result<Option<String>, FalhaExterna> {
        // Sem alvo no ON CONFLICT: tanto a conta que já tem código quanto o código repetido caem aqui.
        sqlx::query("INSERT INTO fichas_de_amizade (conta_id, codigo) VALUES ($1, $2) ON CONFLICT DO NOTHING")
            .bind(conta_id)
            .bind(codigo)
            .execute(&self.0)
            .await
            .map_err(falha)?;
        self.codigo(conta_id).await
    }

    async fn conta_do_codigo(&self, codigo: &str) -> Result<Option<Uuid>, FalhaExterna> {
        sqlx::query_scalar("SELECT conta_id FROM fichas_de_amizade WHERE codigo = $1")
            .bind(codigo)
            .fetch_optional(&self.0)
            .await
            .map_err(falha)
    }

    async fn marcar_visto(&self, conta_id: Uuid, agora: DateTime<Utc>) -> Result<(), FalhaExterna> {
        sqlx::query("UPDATE fichas_de_amizade SET visto_em = $2 WHERE conta_id = $1")
            .bind(conta_id)
            .bind(agora)
            .execute(&self.0)
            .await
            .map_err(falha)?;
        Ok(())
    }

    async fn relacao(&self, quem: Uuid, outro: Uuid) -> Result<Relacao, FalhaExterna> {
        let linha: LinhaDaRelacao = sqlx::query_as(RELACAO).bind(quem).bind(outro).fetch_one(&self.0).await.map_err(falha)?;
        Ok(if linha.bloqueou {
            Relacao::Bloqueou
        } else if linha.foi_bloqueado {
            Relacao::FoiBloqueado
        } else {
            match (linha.solicitante, linha.aceita) {
                (None, _) => Relacao::Nenhuma,
                (_, Some(true)) => Relacao::Amigos,
                (Some(s), _) if s == quem => Relacao::PedidoEnviado,
                _ => Relacao::PedidoRecebido,
            }
        })
    }

    async fn contagens(&self, quem: Uuid, outro: Uuid) -> Result<Contagens, FalhaExterna> {
        let linha: LinhaDasContagens = sqlx::query_as(CONTAGENS).bind(quem).bind(outro).fetch_one(&self.0).await.map_err(falha)?;
        Ok(Contagens {
            amigos_de_quem_pede: linha.amigos_de_quem_pede as u32,
            enviados_de_quem_pede: linha.enviados_de_quem_pede as u32,
            amigos_do_outro: linha.amigos_do_outro as u32,
        })
    }

    async fn criar_pedido(&self, de: Uuid, para: Uuid, agora: DateTime<Utc>) -> Result<(), FalhaExterna> {
        sqlx::query("INSERT INTO amizades (solicitante, destinatario, criada_em) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING")
            .bind(de)
            .bind(para)
            .bind(agora)
            .execute(&self.0)
            .await
            .map_err(falha)?;
        Ok(())
    }

    async fn aceitar(&self, solicitante: Uuid, destinatario: Uuid, agora: DateTime<Utc>) -> Result<bool, FalhaExterna> {
        let feito = sqlx::query("UPDATE amizades SET aceita = true, aceita_em = $3 WHERE solicitante = $1 AND destinatario = $2 AND NOT aceita")
            .bind(solicitante)
            .bind(destinatario)
            .bind(agora)
            .execute(&self.0)
            .await
            .map_err(falha)?;
        Ok(feito.rows_affected() == 1)
    }

    async fn desfazer(&self, a: Uuid, b: Uuid) -> Result<(), FalhaExterna> {
        sqlx::query("DELETE FROM amizades WHERE (solicitante = $1 AND destinatario = $2) OR (solicitante = $2 AND destinatario = $1)")
            .bind(a)
            .bind(b)
            .execute(&self.0)
            .await
            .map_err(falha)?;
        Ok(())
    }

    async fn bloquear(&self, quem: Uuid, outro: Uuid, agora: DateTime<Utc>) -> Result<(), FalhaExterna> {
        let mut transacao = self.0.begin().await.map_err(falha)?;
        sqlx::query("DELETE FROM amizades WHERE (solicitante = $1 AND destinatario = $2) OR (solicitante = $2 AND destinatario = $1)")
            .bind(quem)
            .bind(outro)
            .execute(&mut *transacao)
            .await
            .map_err(falha)?;
        sqlx::query("INSERT INTO bloqueios (quem, bloqueado, criado_em) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING")
            .bind(quem)
            .bind(outro)
            .bind(agora)
            .execute(&mut *transacao)
            .await
            .map_err(falha)?;
        transacao.commit().await.map_err(falha)
    }

    async fn desbloquear(&self, quem: Uuid, outro: Uuid) -> Result<(), FalhaExterna> {
        sqlx::query("DELETE FROM bloqueios WHERE quem = $1 AND bloqueado = $2")
            .bind(quem)
            .bind(outro)
            .execute(&self.0)
            .await
            .map_err(falha)?;
        Ok(())
    }

    async fn pessoas(&self, conta_id: Uuid) -> Result<Vec<Pessoa>, FalhaExterna> {
        let linhas: Vec<LinhaDaPessoa> = sqlx::query_as(PESSOAS).bind(conta_id).fetch_all(&self.0).await.map_err(falha)?;
        Ok(linhas
            .into_iter()
            .map(|l| Pessoa {
                conta_id: l.conta_id,
                nome: l.nome,
                avatar: l.avatar,
                xp_total: l.xp_total.max(0) as u64,
                visto_em: l.visto_em,
                desde: l.desde,
                vinculo: match l.vinculo.as_str() {
                    "amigo" => Vinculo::Amigo,
                    "enviado" => Vinculo::Enviado,
                    "recebido" => Vinculo::Recebido,
                    _ => Vinculo::Bloqueado,
                },
            })
            .collect())
    }

    async fn sugestoes(&self, conta_id: Uuid, limite: u32) -> Result<Vec<Sugestao>, FalhaExterna> {
        let linhas: Vec<LinhaDaSugestao> = sqlx::query_as(SUGESTOES)
            .bind(conta_id)
            .bind(i64::from(limite))
            .fetch_all(&self.0)
            .await
            .map_err(falha)?;
        Ok(linhas
            .into_iter()
            .map(|l| Sugestao {
                conta_id: l.conta_id,
                nome: l.nome,
                avatar: l.avatar,
                xp_total: l.xp_total.max(0) as u64,
                amigos_em_comum: l.amigos_em_comum as u32,
            })
            .collect())
    }
}
