use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Path, State};
use axum::http::header;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use super::casos_de_uso::ErroDoPerfil;
use super::dominio::{EstatisticasDaDificuldade, MusicaMaisTocada, PartidaRecente, PartidasNoInstrumento, Perfil, Recorde};
use super::imagem::TipoDeImagem;
use crate::modules::catalogo::DadosDaMusica;
use crate::modules::conta::{NivelDaConta, Token};
use crate::modules::progresso::{Dificuldade, Instrumento};
use crate::shared::erro::ErroDaApi;
use crate::shared::estado::EstadoDoApp;

impl From<ErroDoPerfil> for ErroDaApi {
    fn from(erro: ErroDoPerfil) -> Self {
        match erro {
            ErroDoPerfil::SessaoInvalida => Self::NaoAutorizado,
            ErroDoPerfil::ImagemInvalida(erro) => Self::Invalido(erro.to_string()),
            ErroDoPerfil::TrocaFrequente => Self::MuitasRequisicoes,
            ErroDoPerfil::Falha(falha) => Self::Interno(falha.0),
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct DificuldadeDoPerfil {
    #[schema(value_type = String, example = "expert")]
    dificuldade: Dificuldade,
    partidas: u32,
    derrotas: u32,
    precisao: f64,
    melhor_pontuacao: u64,
}

impl From<EstatisticasDaDificuldade> for DificuldadeDoPerfil {
    fn from(e: EstatisticasDaDificuldade) -> Self {
        Self {
            precisao: e.precisao(),
            dificuldade: e.dificuldade,
            partidas: e.partidas,
            derrotas: e.derrotas,
            melhor_pontuacao: e.melhor_pontuacao,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct InstrumentoDoPerfil {
    #[schema(value_type = String, example = "guitarra")]
    instrumento: Instrumento,
    partidas: u32,
}

impl From<PartidasNoInstrumento> for InstrumentoDoPerfil {
    fn from(i: PartidasNoInstrumento) -> Self {
        Self {
            instrumento: i.instrumento,
            partidas: i.partidas,
        }
    }
}

/// Do catálogo: sem eles (músicas do jogo, não achadas), o app usa a biblioteca.
#[derive(Serialize, ToSchema)]
pub struct DadosDaMusicaNoPerfil {
    titulo: Option<String>,
    artista: Option<String>,
    /// Endereço da imagem da capa.
    capa: Option<String>,
}

impl From<Option<DadosDaMusica>> for DadosDaMusicaNoPerfil {
    fn from(dados: Option<DadosDaMusica>) -> Self {
        let dados = dados.unwrap_or_default();
        Self {
            titulo: dados.titulo,
            artista: dados.artista,
            capa: dados.capa,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct MusicaDoPerfil {
    musica_id: String,
    partidas: u32,
    #[serde(flatten)]
    dados: DadosDaMusicaNoPerfil,
}

impl From<(MusicaMaisTocada, Option<DadosDaMusica>)> for MusicaDoPerfil {
    fn from((m, dados): (MusicaMaisTocada, Option<DadosDaMusica>)) -> Self {
        Self {
            musica_id: m.musica_id,
            partidas: m.partidas,
            dados: dados.into(),
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct PartidaDoPerfil {
    musica_id: String,
    #[schema(value_type = String, example = "expert")]
    dificuldade: Dificuldade,
    pontos: u64,
    acertos: u32,
    total: u32,
    /// De 0 a 1, a mesma do jogo: cada nota pesa pelo julgamento.
    precisao: f64,
    derrota: bool,
    jogada_em: DateTime<Utc>,
    #[serde(flatten)]
    dados: DadosDaMusicaNoPerfil,
}

impl From<(PartidaRecente, Option<DadosDaMusica>)> for PartidaDoPerfil {
    fn from((p, dados): (PartidaRecente, Option<DadosDaMusica>)) -> Self {
        Self {
            precisao: p.precisao(),
            dados: dados.into(),
            musica_id: p.musica_id,
            dificuldade: p.dificuldade,
            pontos: p.pontos,
            acertos: p.acertos,
            total: p.total,
            derrota: p.derrota,
            jogada_em: p.jogada_em,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct RespostaDoPerfil {
    nome: String,
    avatar: Option<String>,
    email: Option<String>,
    xp_total: u64,
    nivel: NivelDaConta,
    criada_em: DateTime<Utc>,
    /// Endereço da capa que a pessoa escolheu.
    capa: Option<String>,
    partidas: u32,
    derrotas: u32,
    /// De 0 a 1.
    precisao: f64,
    melhor_pontuacao: u64,
    musicas_distintas: u32,
    por_dificuldade: Vec<DificuldadeDoPerfil>,
    /// Só os instrumentos jogados, do mais jogado para o menos.
    por_instrumento: Vec<InstrumentoDoPerfil>,
    mais_tocadas: Vec<MusicaDoPerfil>,
    recentes: Vec<PartidaDoPerfil>,
}

impl From<Perfil> for RespostaDoPerfil {
    fn from(p: Perfil) -> Self {
        let musicas = p.musicas;
        Self {
            nome: p.conta.nome,
            avatar: p.conta.avatar,
            email: p.conta.email,
            xp_total: p.conta.xp_total,
            nivel: p.nivel.into(),
            criada_em: p.criada_em,
            capa: p.capa,
            partidas: p.partidas,
            derrotas: p.derrotas,
            precisao: p.precisao,
            melhor_pontuacao: p.melhor_pontuacao,
            musicas_distintas: p.musicas_distintas,
            por_dificuldade: p.por_dificuldade.into_iter().map(Into::into).collect(),
            por_instrumento: p.por_instrumento.into_iter().map(Into::into).collect(),
            mais_tocadas: p
                .mais_tocadas
                .into_iter()
                .map(|m| (m.musica_id.clone(), m))
                .map(|(id, m)| (m, musicas.get(&id).cloned()).into())
                .collect(),
            recentes: p
                .recentes
                .into_iter()
                .map(|r| (r.musica_id.clone(), r))
                .map(|(id, r)| (r, musicas.get(&id).cloned()).into())
                .collect(),
        }
    }
}

/// O perfil de quem está logado: nível, estatísticas e as últimas partidas.
#[utoipa::path(get, path = "/eu/perfil", responses((status = 200, body = RespostaDoPerfil), (status = 401)), security(("token" = [])))]
pub async fn perfil(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<RespostaDoPerfil>, ErroDaApi> {
    Ok(Json(estado.perfil.perfil(&token).await?.into()))
}

#[derive(Serialize, ToSchema)]
pub struct RecordeDaConta {
    musica_id: String,
    #[schema(value_type = String, example = "expert")]
    dificuldade: Dificuldade,
    #[schema(value_type = String, example = "guitarra")]
    instrumento: Instrumento,
    pontos: u64,
    acertos: u32,
    total: u32,
    /// Fração de 0 a 1; partidas antigas não têm.
    precisao: Option<f64>,
}

impl From<Recorde> for RecordeDaConta {
    fn from(r: Recorde) -> Self {
        Self {
            musica_id: r.musica_id,
            dificuldade: r.dificuldade,
            instrumento: r.instrumento,
            pontos: r.pontos,
            acertos: r.acertos,
            total: r.total,
            precisao: r.precisao,
        }
    }
}

/// A melhor partida terminada de cada música, dificuldade e instrumento de quem está logado.
#[utoipa::path(get, path = "/eu/recordes", responses((status = 200, body = [RecordeDaConta]), (status = 401)), security(("token" = [])))]
pub async fn recordes(State(estado): State<EstadoDoApp>, Token(token): Token) -> Result<Json<Vec<RecordeDaConta>>, ErroDaApi> {
    Ok(Json(estado.perfil.recordes(&token).await?.into_iter().map(Into::into).collect()))
}

fn tipo_da_imagem(texto: &str) -> Result<TipoDeImagem, ErroDaApi> {
    TipoDeImagem::do_texto(texto).ok_or(ErroDaApi::NaoEncontrado)
}

#[derive(Serialize, ToSchema)]
pub struct ImagemTrocada {
    /// Já com a versão: muda a cada troca.
    endereco: String,
}

/// Troca a foto ou a capa de quem está logado. O corpo é a imagem (WebP, JPEG ou PNG), já reduzida pelo app.
#[utoipa::path(
    post,
    path = "/eu/imagens/{tipo}",
    params(("tipo" = String, Path, description = "`foto` ou `capa`")),
    request_body(content = Vec<u8>, content_type = "image/webp"),
    responses((status = 200, body = ImagemTrocada), (status = 400), (status = 401), (status = 404), (status = 413), (status = 429)),
    security(("token" = []))
)]
pub async fn trocar_imagem(
    State(estado): State<EstadoDoApp>,
    Token(token): Token,
    Path(tipo): Path<String>,
    corpo: Bytes,
) -> Result<Json<ImagemTrocada>, ErroDaApi> {
    let tipo = tipo_da_imagem(&tipo)?;
    let endereco = estado.perfil.trocar_imagem(&token, tipo, corpo.to_vec()).await?;
    Ok(Json(ImagemTrocada { endereco }))
}

/// Remove a foto (volta a do Google) ou a capa de quem está logado.
#[utoipa::path(
    delete,
    path = "/eu/imagens/{tipo}",
    params(("tipo" = String, Path, description = "`foto` ou `capa`")),
    responses((status = 204), (status = 401), (status = 404)),
    security(("token" = []))
)]
pub async fn remover_imagem(State(estado): State<EstadoDoApp>, Token(token): Token, Path(tipo): Path<String>) -> Result<axum::http::StatusCode, ErroDaApi> {
    estado.perfil.remover_imagem(&token, tipo_da_imagem(&tipo)?).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// A foto ou a capa de uma conta. O endereço muda a cada troca, então pode ficar em cache para sempre.
#[utoipa::path(
    get,
    path = "/contas/{id}/imagens/{tipo}",
    params(("id" = Uuid, Path), ("tipo" = String, Path, description = "`foto` ou `capa`")),
    responses((status = 200, content_type = "image/webp"), (status = 404))
)]
pub async fn imagem(State(estado): State<EstadoDoApp>, Path((id, tipo)): Path<(Uuid, String)>) -> Result<impl IntoResponse, ErroDaApi> {
    let imagem = estado.perfil.imagem(id, tipo_da_imagem(&tipo)?).await?.ok_or(ErroDaApi::NaoEncontrado)?;
    Ok((
        [
            (header::CONTENT_TYPE, imagem.formato.texto()),
            (header::CACHE_CONTROL, "public, max-age=31536000, immutable"),
        ],
        imagem.conteudo,
    ))
}

/// Folga para o cabeçalho do pedido além da maior imagem aceita.
const CORPO_MAXIMO_DA_IMAGEM: usize = 1024 * 1024 + 4096;

pub fn rotas() -> Router<EstadoDoApp> {
    Router::new()
        .route("/eu/perfil", get(perfil))
        .route("/eu/recordes", get(recordes))
        .route(
            "/eu/imagens/{tipo}",
            post(trocar_imagem).delete(remover_imagem).layer(DefaultBodyLimit::max(CORPO_MAXIMO_DA_IMAGEM)),
        )
        .route("/contas/{id}/imagens/{tipo}", get(imagem))
}
