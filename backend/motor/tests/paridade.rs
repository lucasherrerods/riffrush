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
    estrela_em_ticks: f64,
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
                tempo: n.tempo,
                pista: n.pista,
                frase: n.frase,
                duracao: n.duracao,
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
        assert_eq!(partida.estrela_em_ticks, e.estrela_em_ticks, "caso {i}");
        assert!((partida.pontos - e.pontos).abs() < 1e-6, "caso {i}: {} != {}", partida.pontos, e.pontos);
        assert!((partida.vida - e.vida).abs() < 1e-9, "caso {i}");
    }
}
