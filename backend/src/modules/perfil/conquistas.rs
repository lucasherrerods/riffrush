//! Selos do perfil. Saem das estatísticas da conta na hora, então um rejulgamento ou uma partida apagada
//! já mudam o selo, sem nada guardado para ficar desatualizado.

/// O que a conta já fez, contado pelo banco.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct FeitosDaConta {
    pub partidas_no_rock: u32,
    pub partidas_no_mania: u32,
    /// Partidas terminadas no Rock sem errar nenhuma nota.
    pub full_combos: u32,
    /// Partidas terminadas no Expert do Rock.
    pub expert_concluidas: u32,
    pub amigos: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Medida {
    Partidas,
    FullCombos,
    ExpertConcluidas,
    ModosJogados,
    Nivel,
    Amigos,
}

struct Definicao {
    id: &'static str,
    nome: &'static str,
    descricao: &'static str,
    medida: Medida,
    meta: u32,
}

const CATALOGO: &[Definicao] = &[
    Definicao {
        id: "primeira_musica",
        nome: "Primeira música",
        descricao: "Jogue uma música",
        medida: Medida::Partidas,
        meta: 1,
    },
    Definicao {
        id: "cem_partidas",
        nome: "Cem partidas",
        descricao: "Jogue 100 partidas",
        medida: Medida::Partidas,
        meta: 100,
    },
    Definicao {
        id: "mil_partidas",
        nome: "Mil partidas",
        descricao: "Jogue 1000 partidas",
        medida: Medida::Partidas,
        meta: 1000,
    },
    Definicao {
        id: "primeiro_fc",
        nome: "Primeiro full combo",
        descricao: "Termine uma música do Rock sem errar nenhuma nota",
        medida: Medida::FullCombos,
        meta: 1,
    },
    Definicao {
        id: "dez_fc",
        nome: "Dez full combos",
        descricao: "Faça 10 full combos no Rock",
        medida: Medida::FullCombos,
        meta: 10,
    },
    Definicao {
        id: "mestre_do_expert",
        nome: "Mestre do Expert",
        descricao: "Termine 10 músicas no Expert do Rock",
        medida: Medida::ExpertConcluidas,
        meta: 10,
    },
    Definicao {
        id: "dois_mundos",
        nome: "Dois mundos",
        descricao: "Jogue no Rock e no Mania",
        medida: Medida::ModosJogados,
        meta: 2,
    },
    Definicao {
        id: "nivel_10",
        nome: "Nível 10",
        descricao: "Chegue ao nível 10",
        medida: Medida::Nivel,
        meta: 10,
    },
    Definicao {
        id: "nivel_25",
        nome: "Nível 25",
        descricao: "Chegue ao nível 25",
        medida: Medida::Nivel,
        meta: 25,
    },
    Definicao {
        id: "turma",
        nome: "Turma formada",
        descricao: "Tenha 5 amigos",
        medida: Medida::Amigos,
        meta: 5,
    },
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Conquista {
    pub id: &'static str,
    pub nome: &'static str,
    pub descricao: &'static str,
    /// Quanto já tem, sem passar da meta.
    pub progresso: u32,
    pub meta: u32,
}

impl Conquista {
    pub fn conquistada(&self) -> bool {
        self.progresso >= self.meta
    }
}

fn valor(medida: Medida, feitos: &FeitosDaConta, nivel: u32) -> u32 {
    match medida {
        Medida::Partidas => feitos.partidas_no_rock.saturating_add(feitos.partidas_no_mania),
        Medida::FullCombos => feitos.full_combos,
        Medida::ExpertConcluidas => feitos.expert_concluidas,
        Medida::ModosJogados => u32::from(feitos.partidas_no_rock > 0) + u32::from(feitos.partidas_no_mania > 0),
        Medida::Nivel => nivel,
        Medida::Amigos => feitos.amigos,
    }
}

/// O catálogo inteiro, na ordem fixa, com o progresso da conta em cada selo.
pub fn conquistas(feitos: &FeitosDaConta, nivel: u32) -> Vec<Conquista> {
    CATALOGO
        .iter()
        .map(|d| Conquista {
            id: d.id,
            nome: d.nome,
            descricao: d.descricao,
            progresso: valor(d.medida, feitos, nivel).min(d.meta),
            meta: d.meta,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn achar<'a>(lista: &'a [Conquista], id: &str) -> &'a Conquista {
        lista.iter().find(|c| c.id == id).unwrap()
    }

    #[test]
    fn conta_nova_nao_tem_nenhuma() {
        let lista = conquistas(&FeitosDaConta::default(), 1);
        assert_eq!(lista.len(), CATALOGO.len());
        assert!(lista.iter().all(|c| !c.conquistada()));
    }

    #[test]
    fn partidas_somam_os_dois_modos_e_o_progresso_para_na_meta() {
        let feitos = FeitosDaConta {
            partidas_no_rock: 80,
            partidas_no_mania: 30,
            ..Default::default()
        };
        let lista = conquistas(&feitos, 1);
        assert!(achar(&lista, "cem_partidas").conquistada());
        assert_eq!(achar(&lista, "cem_partidas").progresso, 100);
        assert_eq!(achar(&lista, "mil_partidas").progresso, 110);
        assert!(achar(&lista, "dois_mundos").conquistada());
    }

    #[test]
    fn so_um_modo_deixa_dois_mundos_pela_metade() {
        let feitos = FeitosDaConta {
            partidas_no_mania: 3,
            ..Default::default()
        };
        assert_eq!(achar(&conquistas(&feitos, 1), "dois_mundos").progresso, 1);
    }

    #[test]
    fn nivel_full_combo_expert_e_amigos() {
        let feitos = FeitosDaConta {
            full_combos: 1,
            expert_concluidas: 10,
            amigos: 4,
            ..Default::default()
        };
        let lista = conquistas(&feitos, 12);
        assert!(achar(&lista, "primeiro_fc").conquistada());
        assert!(!achar(&lista, "dez_fc").conquistada());
        assert!(achar(&lista, "mestre_do_expert").conquistada());
        assert!(achar(&lista, "nivel_10").conquistada());
        assert!(!achar(&lista, "nivel_25").conquistada());
        assert_eq!(achar(&lista, "turma").progresso, 4);
    }

    #[test]
    fn os_ids_nao_se_repetem() {
        let mut ids: Vec<_> = CATALOGO.iter().map(|d| d.id).collect();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), CATALOGO.len());
    }
}
