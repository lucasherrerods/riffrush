//! Os .sng de `charts.json` (.chart e .mid sintéticos) foram lidos pelo app: cada trilha tem que sair com as mesmas notas e o mesmo hash.
//! O app confere o mesmo arquivo em `frontend/src/modules/songs/paridadeDosCharts.test.ts`.

use std::collections::HashMap;

use base64::{prelude::BASE64_STANDARD, Engine};
use riffrush_motor::{hash_do_chart, notas_do_sng, Dificuldade, Instrumento, TipoDaNota};
use serde::Deserialize;

#[derive(Deserialize)]
struct Caso {
    sng: String,
    trilhas: HashMap<String, String>,
    notas: HashMap<String, Vec<NotaDoCaso>>,
}

#[derive(Deserialize)]
struct NotaDoCaso {
    tempo: f64,
    pista: u8,
    frase: i32,
    duracao: f64,
    /// "hopo" ou "tap"; sem ele, strum.
    #[serde(default)]
    tipo: Option<String>,
    #[serde(default = "fora_de_solo")]
    solo: i32,
}

fn fora_de_solo() -> i32 {
    -1
}

fn nome_do_tipo(tipo: TipoDaNota) -> Option<&'static str> {
    match tipo {
        TipoDaNota::Strum => None,
        TipoDaNota::Hopo => Some("hopo"),
        TipoDaNota::Tap => Some("tap"),
    }
}

fn instrumento(nome: &str) -> Instrumento {
    match nome {
        "guitarra" => Instrumento::Guitarra,
        "baixo" => Instrumento::Baixo,
        "ritmica" => Instrumento::Ritmica,
        "coop" => Instrumento::Coop,
        _ => Instrumento::Teclado,
    }
}

fn dificuldade(nome: &str) -> Dificuldade {
    match nome {
        "facil" => Dificuldade::Facil,
        "medio" => Dificuldade::Medio,
        "dificil" => Dificuldade::Dificil,
        _ => Dificuldade::Expert,
    }
}

#[test]
fn cada_trilha_sai_com_as_mesmas_notas_e_o_mesmo_hash_do_app() {
    let casos: Vec<Caso> = serde_json::from_str(include_str!("charts.json")).unwrap();
    assert!(!casos.is_empty());
    for (i, caso) in casos.iter().enumerate() {
        let sng = BASE64_STANDARD.decode(&caso.sng).unwrap();
        for (trilha, hash) in &caso.trilhas {
            let (nome_do_instrumento, nome_da_dificuldade) = trilha.split_once(':').unwrap();
            let notas = notas_do_sng(&sng, instrumento(nome_do_instrumento), dificuldade(nome_da_dificuldade)).unwrap();
            let esperadas = &caso.notas[hash];
            assert_eq!(notas.len(), esperadas.len(), "caso {i}, {trilha}");
            for (nota, esperada) in notas.iter().zip(esperadas) {
                assert_eq!(
                    (nota.pista, nota.frase, nota.solo),
                    (esperada.pista, esperada.frase, esperada.solo),
                    "caso {i}, {trilha}"
                );
                assert_eq!(nome_do_tipo(nota.tipo), esperada.tipo.as_deref(), "caso {i}, {trilha}");
                assert!((nota.tempo - esperada.tempo).abs() < 1e-9, "caso {i}, {trilha}");
                assert!((nota.duracao - esperada.duracao).abs() < 1e-9, "caso {i}, {trilha}");
            }
            assert_eq!(&hash_do_chart(&notas), hash, "caso {i}, {trilha}");
        }
    }
}

/// Com `REGRAVAR_CHARTS=1`, reescreve as notas esperadas com o tipo e o solo que o motor lê hoje (para quando a regra muda
/// de propósito). O app confere o mesmo arquivo, então os dois leitores continuam presos ao mesmo resultado.
#[test]
fn regravar_os_charts_quando_pedido() {
    if std::env::var("REGRAVAR_CHARTS").as_deref() != Ok("1") {
        return;
    }
    let caminho = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/charts.json");
    let mut casos: Vec<serde_json::Value> = serde_json::from_str(&std::fs::read_to_string(caminho).unwrap()).unwrap();
    for caso in &mut casos {
        let sng = BASE64_STANDARD.decode(caso["sng"].as_str().unwrap()).unwrap();
        let trilhas: HashMap<String, String> = serde_json::from_value(caso["trilhas"].clone()).unwrap();
        for (trilha, hash) in trilhas {
            let (nome_do_instrumento, nome_da_dificuldade) = trilha.split_once(':').unwrap();
            let notas = notas_do_sng(&sng, instrumento(nome_do_instrumento), dificuldade(nome_da_dificuldade)).unwrap();
            let esperadas = caso["notas"][&hash].as_array_mut().unwrap();
            for (nota, esperada) in notas.iter().zip(esperadas.iter_mut()) {
                let objeto = esperada.as_object_mut().unwrap();
                objeto.remove("tipo");
                if let Some(nome) = nome_do_tipo(nota.tipo) {
                    objeto.insert("tipo".into(), nome.into());
                }
                objeto.insert("solo".into(), nota.solo.into());
            }
        }
    }
    std::fs::write(caminho, serde_json::to_string(&casos).unwrap()).unwrap();
}
