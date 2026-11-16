use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::dominio::{Atividade, Evento};
use super::portas::RepositorioDeAtividades;
use crate::modules::conta::FalhaExterna;
use crate::modules::progresso::{Dificuldade, Instrumento};

pub struct AtividadesPostgres(pub PgPool);

#[derive(FromRow)]
struct Linha {
    tipo: String,
    conta_id: Uuid,
    nome: String,
    avatar: Option<String>,
    quando: DateTime<Utc>,
    musica_id: Option<String>,
    titulo: Option<String>,
    artista: Option<String>,
    instrumento: Option<String>,
    dificuldade: Option<String>,
    precisao: Option<f64>,
    derrota: Option<bool>,
    beatmap_id: Option<i64>,
    beatmapset_id: Option<i64>,
    texto: Option<String>,
}

impl Linha {
    /// Linha com instrumento ou dificuldade que o domínio não conhece fica de fora.
    fn em_atividade(self) -> Option<(Atividade, Option<String>)> {
        let evento = match self.tipo.as_str() {
            "rock" => Evento::PartidaDoRock {
                musica_id: self.musica_id?,
                titulo: self.titulo,
                artista: self.artista,
                instrumento: Instrumento::do_texto(self.instrumento.as_deref()?)?,
                dificuldade: Dificuldade::do_texto(self.dificuldade.as_deref()?)?,
                precisao: self.precisao,
                derrota: self.derrota.unwrap_or(false),
            },
            "mania" => Evento::PartidaDoMania {
                beatmap_id: u64::try_from(self.beatmap_id?).ok()?,
                beatmapset_id: self.beatmapset_id.and_then(|id| u64::try_from(id).ok()),
                titulo: None,
                artista: None,
                dificuldade: None,
                precisao: self.precisao.unwrap_or(0.0),
                derrota: self.derrota.unwrap_or(false),
            },
            "conta" => Evento::ContaNova,
            _ => return None,
        };
        let atividade = Atividade {
            conta_id: self.conta_id,
            nome: self.nome,
            avatar: self.avatar,
            quando: self.quando,
            evento,
        };
        Some((atividade, self.texto))
    }
}

#[async_trait]
impl RepositorioDeAtividades for AtividadesPostgres {
    async fn recentes(&self, antes: Option<DateTime<Utc>>, limite: u32) -> Result<Vec<(Atividade, Option<String>)>, FalhaExterna> {
        // Cada fonte já sai cortada no limite pelo índice da data; a união só ordena o que sobrou.
        let linhas = sqlx::query_as::<_, Linha>(
            "WITH rock AS (
                 SELECT 'rock'::TEXT AS tipo, p.conta_id, p.jogada_em AS quando, p.musica_id, m.titulo, m.artista,
                        p.instrumento, p.dificuldade, p.precisao, p.derrota,
                        NULL::BIGINT AS beatmap_id, NULL::BIGINT AS beatmapset_id, NULL::TEXT AS texto
                 FROM partidas p LEFT JOIN musicas m ON m.musica_id = p.musica_id
                 WHERE p.jogada_em < COALESCE($1, 'infinity'::TIMESTAMPTZ)
                 ORDER BY p.jogada_em DESC LIMIT $2
             ), mania AS (
                 SELECT 'mania'::TEXT, p.conta_id, p.jogada_em, NULL::TEXT, NULL::TEXT, NULL::TEXT,
                        NULL::TEXT, NULL::TEXT, p.precisao, p.derrota,
                        p.beatmap_id, p.beatmapset_id, b.texto
                 FROM partidas_do_mania p LEFT JOIN beatmaps_do_osu b ON b.beatmap_id = p.beatmap_id
                 WHERE p.jogada_em < COALESCE($1, 'infinity'::TIMESTAMPTZ)
                 ORDER BY p.jogada_em DESC LIMIT $2
             ), novas AS (
                 SELECT 'conta'::TEXT, c.id, c.criada_em, NULL::TEXT, NULL::TEXT, NULL::TEXT,
                        NULL::TEXT, NULL::TEXT, NULL::DOUBLE PRECISION, NULL::BOOLEAN,
                        NULL::BIGINT, NULL::BIGINT, NULL::TEXT
                 FROM contas c
                 WHERE c.criada_em < COALESCE($1, 'infinity'::TIMESTAMPTZ)
                 ORDER BY c.criada_em DESC LIMIT $2
             )
             SELECT t.tipo, t.conta_id, c.nome, c.avatar, t.quando, t.musica_id, t.titulo, t.artista,
                    t.instrumento, t.dificuldade, t.precisao, t.derrota, t.beatmap_id, t.beatmapset_id, t.texto
             FROM (SELECT * FROM rock UNION ALL SELECT * FROM mania UNION ALL SELECT * FROM novas) t
             JOIN contas c ON c.id = t.conta_id
             ORDER BY t.quando DESC
             LIMIT $2",
        )
        .bind(antes)
        .bind(i64::from(limite))
        .fetch_all(&self.0)
        .await
        .map_err(|erro| FalhaExterna(format!("banco: {erro}")))?;
        Ok(linhas.into_iter().filter_map(Linha::em_atividade).collect())
    }
}
