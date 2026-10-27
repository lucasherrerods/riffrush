//! Leitor do formato `.osu` (versões 3 a 14), só para o modo mania.
//! Referência do formato: a wiki do osu! ("osu! (file format)"). Arquivos de mapas antigos pulam campos, então tudo
//! que não é essencial tem um padrão.

use md5::{Digest, Md5};

/// Mapas normais vão de 1K a 10K; os de dupla (dois jogadores) chegam a 18K.
pub const MAXIMO_DE_TECLAS: u8 = 18;

/// O modo mania no campo `Mode` do `[General]`.
const MODO_MANIA: u32 = 3;
/// Largura do campo do osu!: a coluna sai da posição x da nota.
const LARGURA_DO_CAMPO: f64 = 512.0;
/// Bits do tipo do objeto.
const TIPO_NOTA: u32 = 1;
const TIPO_NOTA_LONGA: u32 = 128;

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Geral {
    pub arquivo_de_audio: String,
    /// Silêncio antes da música começar, em ms.
    pub atraso_de_entrada_ms: i32,
    /// Onde começa a prévia da música, em ms (-1 sem prévia).
    pub previa_ms: i32,
    /// Mapa de dupla (as colunas se dividem entre duas mãos ou dois jogadores).
    pub estilo_especial: bool,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Metadados {
    pub titulo: String,
    pub titulo_unicode: String,
    pub artista: String,
    pub artista_unicode: String,
    pub mapper: String,
    /// O nome que o mapper deu à dificuldade.
    pub dificuldade: String,
    pub fonte: String,
    pub tags: Vec<String>,
    pub beatmap_id: Option<u64>,
    pub beatmapset_id: Option<u64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Dificuldade {
    /// Número de colunas (`CircleSize` no mania).
    pub teclas: u8,
    /// Overall Difficulty: define as janelas de julgamento.
    pub od: f64,
    /// HP Drain Rate: quanto a vida cai e sobe.
    pub hp: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PontoDeTempo {
    pub tempo_ms: f64,
    /// Duração de uma batida em ms, nos pontos que mudam o BPM.
    pub batida_ms: Option<f64>,
    /// Batidas por compasso.
    pub compasso: u32,
    /// Multiplicador da velocidade de rolagem (SV). 1 nos pontos de BPM.
    pub velocidade: f64,
    pub kiai: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Nota {
    /// Coluna, de 0 a `teclas - 1`, da esquerda para a direita.
    pub coluna: u8,
    pub tempo_ms: i32,
    /// Fim da nota longa; `None` numa nota simples.
    pub fim_ms: Option<i32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Beatmap {
    pub versao_do_formato: u32,
    pub geral: Geral,
    pub metadados: Metadados,
    pub dificuldade: Dificuldade,
    pub fundo: Option<String>,
    /// Arquivo do vídeo de fundo e o atraso dele em ms.
    pub video: Option<(String, i32)>,
    pub pontos_de_tempo: Vec<PontoDeTempo>,
    /// Em ordem de tempo e, no mesmo tempo, de coluna.
    pub notas: Vec<Nota>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ErroDoBeatmap {
    NaoEhOsu,
    /// O mapa é de outro modo do osu! (standard, taiko, catch).
    NaoEhMania(u32),
    TeclasInvalidas(String),
    SemNotas,
    /// Uma linha de nota ou de ponto de tempo que não dá para ler.
    LinhaInvalida(usize),
}

/// md5 do arquivo, em hex: é o "checksum" que o osu! usa para identificar a versão exata do mapa.
pub fn hash_do_beatmap(bytes: &[u8]) -> String {
    Md5::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}

pub fn ler_beatmap(texto: &str) -> Result<Beatmap, ErroDoBeatmap> {
    let texto = texto.strip_prefix('\u{feff}').unwrap_or(texto);
    let mut linhas = texto.lines().enumerate();
    let versao_do_formato = linhas
        .by_ref()
        .map(|(_, l)| l.trim())
        .find(|l| !l.is_empty())
        .and_then(|l| l.strip_prefix("osu file format v"))
        .and_then(|v| v.trim().parse().ok())
        .ok_or(ErroDoBeatmap::NaoEhOsu)?;

    let mut secao = String::new();
    let mut geral = Geral {
        previa_ms: -1,
        ..Geral::default()
    };
    // Sem o campo Mode (mapas bem antigos), o mapa é do modo standard.
    let mut modo = 0;
    let mut metadados = Metadados::default();
    let mut teclas = None;
    let mut od = 5.0;
    let mut hp = 5.0;
    let mut fundo = None;
    let mut video = None;
    let mut pontos_de_tempo = Vec::new();
    let mut objetos = Vec::new();

    for (indice, linha) in linhas {
        let linha = linha.trim();
        if linha.is_empty() || linha.starts_with("//") {
            continue;
        }
        if linha.starts_with('[') && linha.ends_with(']') {
            secao = linha[1..linha.len() - 1].to_string();
            continue;
        }
        let numero_da_linha = indice + 1;
        match secao.as_str() {
            "General" | "Metadata" | "Difficulty" => {
                let Some((chave, valor)) = linha.split_once(':') else { continue };
                let valor = valor.trim();
                match (secao.as_str(), chave.trim()) {
                    ("General", "AudioFilename") => geral.arquivo_de_audio = valor.to_string(),
                    ("General", "AudioLeadIn") => geral.atraso_de_entrada_ms = valor.parse().unwrap_or(0),
                    ("General", "PreviewTime") => geral.previa_ms = valor.parse().unwrap_or(-1),
                    ("General", "Mode") => modo = valor.parse().unwrap_or(0),
                    ("General", "SpecialStyle") => geral.estilo_especial = valor == "1",
                    ("Metadata", "Title") => metadados.titulo = valor.to_string(),
                    ("Metadata", "TitleUnicode") => metadados.titulo_unicode = valor.to_string(),
                    ("Metadata", "Artist") => metadados.artista = valor.to_string(),
                    ("Metadata", "ArtistUnicode") => metadados.artista_unicode = valor.to_string(),
                    ("Metadata", "Creator") => metadados.mapper = valor.to_string(),
                    ("Metadata", "Version") => metadados.dificuldade = valor.to_string(),
                    ("Metadata", "Source") => metadados.fonte = valor.to_string(),
                    ("Metadata", "Tags") => metadados.tags = valor.split_whitespace().map(str::to_string).collect(),
                    ("Metadata", "BeatmapID") => metadados.beatmap_id = valor.parse().ok().filter(|&id| id > 0),
                    ("Metadata", "BeatmapSetID") => metadados.beatmapset_id = valor.parse().ok().filter(|&id| id > 0),
                    ("Difficulty", "CircleSize") => teclas = Some(valor.to_string()),
                    ("Difficulty", "OverallDifficulty") => od = valor.parse().unwrap_or(od),
                    ("Difficulty", "HPDrainRate") => hp = valor.parse().unwrap_or(hp),
                    _ => {}
                }
            }
            "Events" => {
                let campos: Vec<&str> = linha.split(',').map(str::trim).collect();
                let arquivo = || campos.get(2).map(|a| a.trim_matches('"').to_string());
                match campos.first().copied() {
                    Some("0") if fundo.is_none() => fundo = arquivo(),
                    Some("1" | "Video") if video.is_none() => {
                        video = arquivo().map(|a| (a, campos.get(1).and_then(|t| t.parse().ok()).unwrap_or(0)));
                    }
                    _ => {}
                }
            }
            "TimingPoints" => pontos_de_tempo.push(ler_ponto_de_tempo(linha).ok_or(ErroDoBeatmap::LinhaInvalida(numero_da_linha))?),
            "HitObjects" => objetos.push((linha, numero_da_linha)),
            _ => {}
        }
    }

    if modo != MODO_MANIA {
        return Err(ErroDoBeatmap::NaoEhMania(modo));
    }
    let teclas_lidas = teclas.unwrap_or_default();
    let teclas = teclas_lidas
        .parse::<f64>()
        .ok()
        .filter(|t| t.fract() == 0.0 && (1.0..=f64::from(MAXIMO_DE_TECLAS)).contains(t))
        .map(|t| t as u8)
        .ok_or(ErroDoBeatmap::TeclasInvalidas(teclas_lidas))?;

    let mut notas = objetos
        .into_iter()
        .map(|(linha, numero)| ler_nota(linha, teclas).ok_or(ErroDoBeatmap::LinhaInvalida(numero)))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    if notas.is_empty() {
        return Err(ErroDoBeatmap::SemNotas);
    }
    notas.sort_by_key(|n| (n.tempo_ms, n.coluna));
    pontos_de_tempo.sort_by(|a, b| a.tempo_ms.total_cmp(&b.tempo_ms));

    Ok(Beatmap {
        versao_do_formato,
        geral,
        metadados,
        dificuldade: Dificuldade { teclas, od, hp },
        fundo,
        video,
        pontos_de_tempo,
        notas,
    })
}

/// `tempo,duração da batida,compasso,amostras,índice,volume,herdado,efeitos`. Os mapas antigos param nos dois primeiros.
fn ler_ponto_de_tempo(linha: &str) -> Option<PontoDeTempo> {
    let campos: Vec<&str> = linha.split(',').map(str::trim).collect();
    let tempo_ms: f64 = campos.first()?.parse().ok()?;
    let batida: f64 = campos.get(1)?.parse().ok()?;
    let compasso = campos.get(2).and_then(|c| c.parse().ok()).filter(|&c| c > 0).unwrap_or(4);
    // Sem o campo, o ponto é de BPM quando a duração é positiva; as velocidades vêm com duração negativa.
    let muda_o_bpm = campos.get(6).map_or(batida > 0.0, |c| *c == "1");
    let efeitos: u32 = campos.get(7).and_then(|e| e.parse().ok()).unwrap_or(0);
    Some(PontoDeTempo {
        tempo_ms,
        batida_ms: muda_o_bpm.then_some(batida),
        compasso,
        velocidade: if muda_o_bpm || batida >= 0.0 {
            1.0
        } else {
            (-100.0 / batida).clamp(0.01, 10.0)
        },
        kiai: efeitos & 1 != 0,
    })
}

/// `x,y,tempo,tipo,som,fim:amostras`. Devolve `None` dentro do `Some` para objetos que não são notas (o mania só tem notas).
fn ler_nota(linha: &str, teclas: u8) -> Option<Option<Nota>> {
    let campos: Vec<&str> = linha.split(',').map(str::trim).collect();
    let x: f64 = campos.first()?.parse().ok()?;
    let tempo_ms = ler_inteiro(campos.get(2)?)?;
    let tipo: u32 = campos.get(3)?.parse().ok()?;
    let coluna = ((x * f64::from(teclas) / LARGURA_DO_CAMPO).floor().max(0.0) as u8).min(teclas - 1);
    if tipo & TIPO_NOTA_LONGA != 0 {
        let fim_ms = ler_inteiro(campos.get(5)?.split(':').next()?)?;
        // Nota longa sem duração vira nota simples, como no osu!.
        return Some(Some(Nota {
            coluna,
            tempo_ms,
            fim_ms: (fim_ms > tempo_ms).then_some(fim_ms),
        }));
    }
    Some((tipo & TIPO_NOTA != 0).then_some(Nota {
        coluna,
        tempo_ms,
        fim_ms: None,
    }))
}

/// Alguns mapas gravam tempos com casas decimais.
fn ler_inteiro(texto: &str) -> Option<i32> {
    let valor: f64 = texto.trim().parse().ok()?;
    valor.is_finite().then(|| valor.round() as i32)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mapa(teclas: &str, notas: &str) -> String {
        format!(
            "osu file format v14\n\n[General]\nAudioFilename: audio.mp3\nAudioLeadIn: 0\nPreviewTime: 1200\nMode: 3\n\n\
             [Metadata]\nTitle:Musica\nTitleUnicode:Música\nArtist:Banda\nArtistUnicode:Banda\nCreator:Mapper\nVersion:Hard\nTags:rock teste\nBeatmapID:123\nBeatmapSetID:45\n\n\
             [Difficulty]\nHPDrainRate:8\nCircleSize:{teclas}\nOverallDifficulty:7.5\n\n\
             [Events]\n//Background and Video events\n0,0,\"fundo.jpg\",0,0\nVideo,-200,\"clipe.mp4\"\n\n\
             [TimingPoints]\n1000,500,4,2,0,40,1,0\n3000,-50,4,2,0,40,0,1\n\n[HitObjects]\n{notas}"
        )
    }

    #[test]
    fn le_cabecalho_metadados_e_dificuldade() {
        let b = ler_beatmap(&mapa("4", "64,192,1000,1,0,0:0:0:0:")).unwrap();
        assert_eq!(b.versao_do_formato, 14);
        assert_eq!(b.geral.arquivo_de_audio, "audio.mp3");
        assert_eq!(b.geral.previa_ms, 1200);
        assert_eq!(b.metadados.titulo_unicode, "Música");
        assert_eq!(b.metadados.dificuldade, "Hard");
        assert_eq!(b.metadados.mapper, "Mapper");
        assert_eq!(b.metadados.tags, ["rock", "teste"]);
        assert_eq!((b.metadados.beatmap_id, b.metadados.beatmapset_id), (Some(123), Some(45)));
        assert_eq!(b.dificuldade, Dificuldade { teclas: 4, od: 7.5, hp: 8.0 });
        assert_eq!(b.fundo.as_deref(), Some("fundo.jpg"));
        assert_eq!(b.video, Some(("clipe.mp4".to_string(), -200)));
    }

    #[test]
    fn a_coluna_sai_da_posicao_x() {
        // 4K: x = 64, 192, 320, 448 são as colunas 0 a 3.
        let b = ler_beatmap(&mapa("4", "448,192,1000,1,0\n64,192,1000,1,0\n192,192,1500,1,0\n320,192,2000,1,0")).unwrap();
        let colunas: Vec<_> = b.notas.iter().map(|n| (n.tempo_ms, n.coluna)).collect();
        assert_eq!(colunas, [(1000, 0), (1000, 3), (1500, 1), (2000, 2)]);
    }

    #[test]
    fn colunas_de_7k_e_x_fora_do_campo_ficam_dentro() {
        let b = ler_beatmap(&mapa("7", "36,192,1000,1,0\n475,192,1100,1,0\n600,192,1200,1,0\n-5,192,1300,1,0")).unwrap();
        let colunas: Vec<_> = b.notas.iter().map(|n| n.coluna).collect();
        assert_eq!(colunas, [0, 6, 6, 0]);
    }

    #[test]
    fn le_notas_longas_pelo_fim_no_campo_de_amostras() {
        let b = ler_beatmap(&mapa("4", "64,192,1000,128,0,1750:0:0:0:0:\n192,192,2000,128,0,2000:0:0:0:0:")).unwrap();
        assert_eq!(
            b.notas[0],
            Nota {
                coluna: 0,
                tempo_ms: 1000,
                fim_ms: Some(1750)
            }
        );
        // Sem duração, vira nota simples.
        assert_eq!(b.notas[1].fim_ms, None);
    }

    #[test]
    fn pontos_de_tempo_de_bpm_e_de_velocidade() {
        let b = ler_beatmap(&mapa("4", "64,192,1000,1,0")).unwrap();
        assert_eq!(
            b.pontos_de_tempo,
            [
                PontoDeTempo {
                    tempo_ms: 1000.0,
                    batida_ms: Some(500.0),
                    compasso: 4,
                    velocidade: 1.0,
                    kiai: false
                },
                PontoDeTempo {
                    tempo_ms: 3000.0,
                    batida_ms: None,
                    compasso: 4,
                    velocidade: 2.0,
                    kiai: true
                },
            ]
        );
    }

    #[test]
    fn le_mapas_de_formato_antigo_com_campos_faltando() {
        let antigo = "osu file format v5\r\n[General]\r\nAudioFilename: a.mp3\r\nMode: 3\r\n[Difficulty]\r\nCircleSize:5\r\n\
                      [TimingPoints]\r\n500,400\r\n900,-200\r\n[HitObjects]\r\n51,192,500.4,1,0\r\n";
        let b = ler_beatmap(antigo).unwrap();
        assert_eq!(b.versao_do_formato, 5);
        assert_eq!(b.dificuldade, Dificuldade { teclas: 5, od: 5.0, hp: 5.0 });
        assert_eq!(
            b.notas,
            [Nota {
                coluna: 0,
                tempo_ms: 500,
                fim_ms: None
            }]
        );
        assert_eq!(b.pontos_de_tempo[0].batida_ms, Some(400.0));
        assert_eq!(b.pontos_de_tempo[1].velocidade, 0.5);
    }

    #[test]
    fn aceita_bom_e_mapas_de_dupla() {
        let texto = format!("\u{feff}{}", mapa("18", "10,192,1000,1,0").replace("Mode: 3", "Mode: 3\nSpecialStyle: 1"));
        let b = ler_beatmap(&texto).unwrap();
        assert_eq!(b.dificuldade.teclas, 18);
        assert!(b.geral.estilo_especial);
    }

    #[test]
    fn recusa_o_que_nao_e_mania() {
        assert_eq!(ler_beatmap("não é um beatmap"), Err(ErroDoBeatmap::NaoEhOsu));
        assert_eq!(
            ler_beatmap(&mapa("4", "64,192,1000,1,0").replace("Mode: 3", "Mode: 0")),
            Err(ErroDoBeatmap::NaoEhMania(0))
        );
        assert_eq!(
            ler_beatmap(&mapa("4", "64,192,1000,1,0").replace("Mode: 3\n", "")),
            Err(ErroDoBeatmap::NaoEhMania(0))
        );
        assert_eq!(ler_beatmap(&mapa("0", "64,192,1000,1,0")), Err(ErroDoBeatmap::TeclasInvalidas("0".into())));
        assert_eq!(ler_beatmap(&mapa("19", "64,192,1000,1,0")), Err(ErroDoBeatmap::TeclasInvalidas("19".into())));
        assert_eq!(ler_beatmap(&mapa("4.5", "64,192,1000,1,0")), Err(ErroDoBeatmap::TeclasInvalidas("4.5".into())));
        assert_eq!(ler_beatmap(&mapa("4", "")), Err(ErroDoBeatmap::SemNotas));
        assert!(matches!(ler_beatmap(&mapa("4", "64,192,abc,1,0")), Err(ErroDoBeatmap::LinhaInvalida(_))));
    }

    #[test]
    fn o_hash_e_o_md5_do_arquivo() {
        assert_eq!(hash_do_beatmap(b""), "d41d8cd98f00b204e9800998ecf8427e");
        assert_eq!(hash_do_beatmap(b"osu"), "a0485de5d3213f4bc5c38e2d302bd169");
    }
}
