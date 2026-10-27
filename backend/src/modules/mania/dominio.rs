use riffrush_motor_mania as motor;

use crate::modules::progresso::xp_pelos_numeros;

/// Um replay de um mapa longo e denso fica com poucas dezenas de KB.
pub const TAMANHO_MAXIMO_DO_REPLAY: usize = 512 * 1024;

/// Só os mapas que não mudam mais valem XP e ranking: o md5 do .osu continua o mesmo para sempre.
const STATUS_QUE_VALEM: [&str; 3] = ["ranked", "approved", "loved"];

pub fn status_vale_xp(status: &str) -> bool {
    STATUS_QUE_VALEM.contains(&status)
}

/// O resultado da partida segundo o servidor, tirado só do replay e do .osu.
#[derive(Debug, Clone, PartialEq)]
pub struct Rejulgada {
    pub pontuacao: u32,
    /// De 0 a 1, com o MAX valendo 305.
    pub precisao: f64,
    /// De MAX a Miss.
    pub contagem: [u32; 6],
    pub maior_combo: u32,
    pub derrota: bool,
    pub mods: u32,
    /// Julgamentos do mapa: um por nota e dois por nota longa.
    pub total: u32,
    /// Random e Autoplay jogam, mas não entram no ranking.
    pub mods_valem_ranking: bool,
    pub multiplicador_dos_mods: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum Recusa {
    #[error("replay ilegível")]
    ReplayInvalido,
    #[error("o replay é de outro mapa")]
    MapaDiferente,
    #[error("o .osu não é um mapa mania válido")]
    MapaInvalido,
    #[error("combinação de mods inválida")]
    ModsInvalidos,
    #[error("o replay toca uma coluna que o mapa não tem")]
    ColunaInvalida,
}

/// Toca o replay sobre o .osu com o mesmo motor do app.
pub fn rejulgar(texto_do_osu: &str, replay: &[u8]) -> Result<Rejulgada, Recusa> {
    if replay.len() > TAMANHO_MAXIMO_DO_REPLAY {
        return Err(Recusa::ReplayInvalido);
    }
    let replay = motor::desempacotar_replay(replay).map_err(|_| Recusa::ReplayInvalido)?;
    if motor::hash_do_beatmap(texto_do_osu.as_bytes()) != replay.hash {
        return Err(Recusa::MapaDiferente);
    }
    let beatmap = motor::ler_beatmap(texto_do_osu).map_err(|_| Recusa::MapaInvalido)?;
    replay.mods.validar().map_err(|_| Recusa::ModsInvalidos)?;
    if replay.entradas.iter().any(|e| e.coluna >= beatmap.dificuldade.teclas) {
        return Err(Recusa::ColunaInvalida);
    }
    let partida = motor::jogar_replay(&beatmap, &replay);
    Ok(Rejulgada {
        pontuacao: motor::pontuacao(&partida),
        precisao: motor::precisao(&partida),
        contagem: partida.contagem,
        maior_combo: partida.maior_combo,
        derrota: partida.derrota,
        mods: replay.mods.0,
        total: motor::total_de_julgamentos(&partida),
        mods_valem_ranking: replay.mods.vale_ranking(),
        multiplicador_dos_mods: replay.mods.multiplicador(),
    })
}

/// A base do XP pelas estrelas do mapa: 1★ vale como o Fácil do Rock e 5★ como o Expert.
pub fn base_das_estrelas(estrelas: f64) -> f64 {
    (30.0 + 42.0 * estrelas).clamp(50.0, 360.0)
}

/// A mesma fórmula do Rock: base pelas estrelas, curva da precisão, raiz das notas e repetição do dia. Perder a
/// música rende um quarto, e os mods que facilitam reduzem o XP como reduzem a pontuação.
pub fn xp_do_mania(estrelas: f64, rejulgada: &Rejulgada, repeticoes: u32) -> u64 {
    let castigo = if rejulgada.derrota { 0.25 } else { 1.0 } * rejulgada.multiplicador_dos_mods;
    xp_pelos_numeros(base_das_estrelas(estrelas), rejulgada.total, rejulgada.precisao, castigo, repeticoes)
}

/// Entra no ranking: mapa ranked ou loved, sem derrota e sem os mods que não valem.
pub fn vale_ranking(status: &str, rejulgada: &Rejulgada) -> bool {
    status_vale_xp(status) && !rejulgada.derrota && rejulgada.mods_valem_ranking
}

#[cfg(test)]
pub mod tests {
    use super::*;

    /// Um mapa 4K com `notas` notas simples, uma a cada 200 ms na coluna 0.
    pub fn mapa(notas: u32) -> String {
        let objetos: String = (0..notas).map(|i| format!("64,192,{},1,0,0:0:0:0:\n", 1000 + i * 200)).collect();
        format!("osu file format v14\n[General]\nMode: 3\n[Difficulty]\nCircleSize:4\nOverallDifficulty:8\nHPDrainRate:5\n[HitObjects]\n{objetos}")
    }

    /// Um replay que acerta tudo na hora certa.
    pub fn replay_perfeito(texto: &str, notas: u32, mods: motor::Mods) -> Vec<u8> {
        let velocidade = mods.velocidade();
        let entradas = (0..notas)
            .flat_map(|i| {
                let tempo = (f64::from(1000 + i * 200) / velocidade).round() as i32;
                [
                    motor::Entrada {
                        tempo_ms: tempo,
                        coluna: 0,
                        toca: true,
                    },
                    motor::Entrada {
                        tempo_ms: tempo + 30,
                        coluna: 0,
                        toca: false,
                    },
                ]
            })
            .collect();
        motor::empacotar_replay(&motor::Replay {
            mods,
            semente: 0,
            hash: motor::hash_do_beatmap(texto.as_bytes()),
            entradas,
        })
    }

    #[test]
    fn rejulga_o_replay_com_o_motor() {
        let texto = mapa(100);
        let r = rejulgar(&texto, &replay_perfeito(&texto, 100, motor::Mods::NENHUM)).unwrap();
        assert_eq!(
            (r.pontuacao, r.contagem[0], r.maior_combo, r.derrota, r.total),
            (1_000_000, 100, 100, false, 100)
        );
        assert!(r.mods_valem_ranking);
    }

    #[test]
    fn recusa_replay_de_outro_mapa_quebrado_ou_com_colunas_a_mais() {
        let texto = mapa(100);
        let outro = mapa(99);
        assert_eq!(rejulgar(&outro, &replay_perfeito(&texto, 100, motor::Mods::NENHUM)), Err(Recusa::MapaDiferente));
        assert_eq!(rejulgar(&texto, &[1, 2, 3]), Err(Recusa::ReplayInvalido));
        let coluna_a_mais = motor::empacotar_replay(&motor::Replay {
            mods: motor::Mods::NENHUM,
            semente: 0,
            hash: motor::hash_do_beatmap(texto.as_bytes()),
            entradas: vec![motor::Entrada {
                tempo_ms: 1000,
                coluna: 9,
                toca: true,
            }],
        });
        assert_eq!(rejulgar(&texto, &coluna_a_mais), Err(Recusa::ColunaInvalida));
        let mods_em_conflito = replay_perfeito(&texto, 1, motor::Mods::EZ.com(motor::Mods::HR));
        assert_eq!(rejulgar(&texto, &mods_em_conflito), Err(Recusa::ModsInvalidos));
    }

    #[test]
    fn so_ranked_approved_e_loved_valem() {
        assert!(status_vale_xp("ranked") && status_vale_xp("loved") && status_vale_xp("approved"));
        assert!(!status_vale_xp("graveyard") && !status_vale_xp("qualified") && !status_vale_xp("pending"));
    }

    #[test]
    fn xp_cresce_com_as_estrelas_e_cai_com_derrota_e_mods_que_facilitam() {
        let texto = mapa(400);
        let r = rejulgar(&texto, &replay_perfeito(&texto, 400, motor::Mods::NENHUM)).unwrap();
        assert!(xp_do_mania(5.0, &r, 0) > xp_do_mania(2.0, &r, 0));
        let derrota = Rejulgada { derrota: true, ..r.clone() };
        assert_eq!(xp_do_mania(5.0, &derrota, 0), (xp_do_mania(5.0, &r, 0) as f64 / 4.0).round() as u64);
        let facil = rejulgar(&texto, &replay_perfeito(&texto, 400, motor::Mods::EZ)).unwrap();
        assert_eq!(xp_do_mania(5.0, &facil, 0), (xp_do_mania(5.0, &r, 0) as f64 / 2.0).round() as u64);
        // Mapa curto demais não vale XP, como no Rock.
        let curto = mapa(10);
        assert_eq!(
            xp_do_mania(5.0, &rejulgar(&curto, &replay_perfeito(&curto, 10, motor::Mods::NENHUM)).unwrap(), 0),
            0
        );
    }

    #[test]
    fn a_base_das_estrelas_fica_na_faixa_do_rock() {
        assert_eq!(base_das_estrelas(0.4), 50.0);
        assert_eq!(base_das_estrelas(5.0), 240.0);
        assert_eq!(base_das_estrelas(12.0), 360.0);
    }

    #[test]
    fn ranking_so_sem_derrota_e_com_mods_que_valem() {
        let texto = mapa(100);
        let r = rejulgar(&texto, &replay_perfeito(&texto, 100, motor::Mods::NENHUM)).unwrap();
        assert!(vale_ranking("ranked", &r));
        assert!(!vale_ranking("graveyard", &r));
        assert!(!vale_ranking("ranked", &Rejulgada { derrota: true, ..r.clone() }));
        assert!(!vale_ranking(
            "ranked",
            &Rejulgada {
                mods_valem_ranking: false,
                ..r
            }
        ));
    }
}
