//! Os casos de `paridade.json` rodam aqui e no app (com o .wasm commitado): os dois têm de dar o mesmo resultado.
//! Para refazer os resultados esperados depois de mudar uma regra: `PARIDADE_GERAR=1 cargo test --test paridade`.

use riffrush_motor_mania::{avancar, criar_partida, ler_beatmap, pontuacao, precisao, soltar, tocar, Mods, OpcoesDaPartida};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
struct Caso {
    nome: String,
    mapa: String,
    mods: u32,
    semente: u32,
    /// [tempo, coluna, 1 = toca / 0 = solta].
    entradas: Vec<[i32; 3]>,
    fim_ms: i32,
    esperado: Option<Resultado>,
}

#[derive(Deserialize, Serialize, PartialEq, Debug)]
struct Resultado {
    contagem: [u32; 6],
    pontuacao: u32,
    /// Em milionésimos, para não depender da formatação de números com casas.
    precisao: u64,
    maior_combo: u32,
    derrota: bool,
}

fn jogar(caso: &Caso) -> Resultado {
    let beatmap = ler_beatmap(&caso.mapa).unwrap();
    let mut partida = criar_partida(
        &beatmap,
        OpcoesDaPartida {
            mods: Mods(caso.mods),
            semente: caso.semente,
        },
    );
    for &[tempo, coluna, toca] in &caso.entradas {
        let coluna = u8::try_from(coluna).unwrap();
        if toca == 1 {
            tocar(&mut partida, coluna, tempo);
        } else {
            soltar(&mut partida, coluna, tempo);
        }
    }
    avancar(&mut partida, caso.fim_ms);
    Resultado {
        contagem: partida.contagem,
        pontuacao: pontuacao(&partida),
        precisao: (precisao(&partida) * 1e6).round() as u64,
        maior_combo: partida.maior_combo,
        derrota: partida.derrota,
    }
}

#[test]
fn casos_de_paridade() {
    let caminho = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/paridade.json");
    let mut casos: Vec<Caso> = serde_json::from_str(&std::fs::read_to_string(caminho).unwrap()).unwrap();
    if std::env::var("PARIDADE_GERAR").is_ok() {
        for caso in &mut casos {
            caso.esperado = Some(jogar(caso));
        }
        std::fs::write(caminho, serde_json::to_string_pretty(&casos).unwrap() + "\n").unwrap();
        return;
    }
    for caso in &casos {
        assert_eq!(Some(jogar(caso)), caso.esperado, "caso {}", caso.nome);
    }
}
