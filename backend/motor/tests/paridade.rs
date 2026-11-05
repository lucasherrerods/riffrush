//! Os casos de `paridade.json` foram gravados pelo motor do app: tocar o mesmo replay aqui tem que dar o mesmo resultado.
//! O app confere o mesmo arquivo em `frontend/src/modules/gameplay/paridade.test.ts`.

use base64::{prelude::BASE64_STANDARD, Engine};
use riffrush_motor::{aplicar_entradas, avancar, criar_partida, desempacotar_replay, Nota, OpcoesDaPartida};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Caso {
    notas: Vec<NotaDoCaso>,
    sem_falha: bool,
    fantasma: bool,
    replay: String,
    fim: f64,
    esperado: Esperado,
}

#[derive(Deserialize)]
struct NotaDoCaso {
    tempo: f64,
    pista: u8,
    frase: i32,
    duracao: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Esperado {
    pontos: f64,
    acertos: u32,
    erros: u32,
    julgamentos: Julgamentos,
    valor_dos_acertos: u32,
    sequencia: u32,
    maior_sequencia: u32,
    vida: f64,
    #[serde(alias = "estrelaEmTicks")]
    estrela_em_compassos: f64,
    estrela_ativa: bool,
    derrota: bool,
    fantasma: bool,
}

#[derive(Deserialize)]
struct Julgamentos {
    perfeito: u32,
    otimo: u32,
    bom: u32,
}

/// Com `REGRAVAR_PARIDADE=1`, reescreve o resultado esperado de cada caso com o motor de agora (para quando a regra muda
/// de propósito). O app confere o mesmo arquivo, então os dois lados continuam presos ao mesmo resultado.
#[test]
fn regravar_os_casos_quando_pedido() {
    if std::env::var("REGRAVAR_PARIDADE").as_deref() != Ok("1") {
        return;
    }
    let caminho = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/paridade.json");
    let mut casos: Vec<serde_json::Value> = serde_json::from_str(&std::fs::read_to_string(caminho).unwrap()).unwrap();
    for caso in &mut casos {
        let tipado: Caso = serde_json::from_value(caso.clone()).unwrap();
        let partida = jogar(&tipado);
        caso["esperado"] = serde_json::json!({
            "pontos": partida.pontos,
            "acertos": partida.acertos,
            "erros": partida.erros,
            "julgamentos": { "perfeito": partida.perfeitos, "otimo": partida.otimos, "bom": partida.bons },
            "valorDosAcertos": partida.valor_dos_acertos,
            "sequencia": partida.sequencia,
            "maiorSequencia": partida.maior_sequencia,
            "vida": partida.vida,
            "estrelaEmCompassos": partida.estrela_em_compassos,
            "estrelaAtiva": partida.estrela_ativa,
            "derrota": partida.derrota,
            "fantasma": partida.fantasma,
        });
    }
    std::fs::write(caminho, serde_json::to_string(&casos).unwrap()).unwrap();
}

fn jogar(caso: &Caso) -> riffrush_motor::Partida {
    let replay = desempacotar_replay(&BASE64_STANDARD.decode(&caso.replay).unwrap()).unwrap();
    let notas: Vec<Nota> = caso
        .notas
        .iter()
        .map(|n| Nota {
            frase: n.frase,
            duracao: n.duracao,
            ..Nota::simples(n.tempo, n.pista)
        })
        .collect();
    let mut partida = criar_partida(
        &notas,
        OpcoesDaPartida {
            sem_falha: replay.sem_falha,
            fantasma: replay.fantasma,
            velocidade: replay.velocidade,
            sem_aberta: replay.sem_aberta,
            jeito: replay.jeito,
        },
    );
    aplicar_entradas(&mut partida, &replay.entradas);
    avancar(&mut partida, caso.fim);
    partida
}

#[test]
fn o_replay_da_o_mesmo_resultado_que_no_app() {
    let casos: Vec<Caso> = serde_json::from_str(include_str!("paridade.json")).unwrap();
    assert!(!casos.is_empty());
    for (i, caso) in casos.iter().enumerate() {
        let replay = desempacotar_replay(&BASE64_STANDARD.decode(&caso.replay).unwrap()).unwrap();
        assert_eq!((replay.sem_falha, replay.fantasma), (caso.sem_falha, caso.fantasma), "caso {i}");
        let notas: Vec<Nota> = caso
            .notas
            .iter()
            .map(|n| Nota {
                frase: n.frase,
                duracao: n.duracao,
                ..Nota::simples(n.tempo, n.pista)
            })
            .collect();
        let mut partida = criar_partida(
            &notas,
            OpcoesDaPartida {
                sem_falha: replay.sem_falha,
                fantasma: replay.fantasma,
                velocidade: replay.velocidade,
                sem_aberta: replay.sem_aberta,
                jeito: replay.jeito,
            },
        );
        aplicar_entradas(&mut partida, &replay.entradas);
        avancar(&mut partida, caso.fim);

        let e = &caso.esperado;
        assert_eq!(
            (
                partida.acertos,
                partida.erros,
                partida.perfeitos,
                partida.otimos,
                partida.bons,
                partida.valor_dos_acertos
            ),
            (
                e.acertos,
                e.erros,
                e.julgamentos.perfeito,
                e.julgamentos.otimo,
                e.julgamentos.bom,
                e.valor_dos_acertos
            ),
            "caso {i}"
        );
        assert_eq!((partida.sequencia, partida.maior_sequencia), (e.sequencia, e.maior_sequencia), "caso {i}");
        assert_eq!(
            (partida.estrela_ativa, partida.derrota, partida.fantasma),
            (e.estrela_ativa, e.derrota, e.fantasma),
            "caso {i}"
        );
        assert!((partida.estrela_em_compassos - e.estrela_em_compassos).abs() < 1e-9, "caso {i}");
        assert!((partida.pontos - e.pontos).abs() < 1e-6, "caso {i}: {} != {}", partida.pontos, e.pontos);
        assert!((partida.vida - e.vida).abs() < 1e-9, "caso {i}");
    }
}
