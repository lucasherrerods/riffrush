//! Os .sng de `charts.json` (.chart e .mid sintéticos) foram lidos pelo app: cada trilha tem que sair com as mesmas notas e o mesmo hash.
//! O app confere o mesmo arquivo em `frontend/src/modules/songs/paridadeDosCharts.test.ts`.

use std::collections::HashMap;

use base64::{prelude::BASE64_STANDARD, Engine};
use riffrush_motor::{hash_do_chart, notas_do_sng, Dificuldade, Instrumento};
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
                assert_eq!((nota.pista, nota.frase), (esperada.pista, esperada.frase), "caso {i}, {trilha}");
                assert!((nota.tempo - esperada.tempo).abs() < 1e-9, "caso {i}, {trilha}");
                assert!((nota.duracao - esperada.duracao).abs() < 1e-9, "caso {i}, {trilha}");
            }
            assert_eq!(&hash_do_chart(&notas), hash, "caso {i}, {trilha}");
        }
    }
}
