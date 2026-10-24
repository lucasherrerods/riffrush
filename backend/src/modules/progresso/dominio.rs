//! Regras de XP e nível. Só o servidor calcula: o cliente manda o resumo da partida e recebe o XP.

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Dificuldade {
    Facil,
    Medio,
    Dificil,
    Expert,
}

impl Dificuldade {
    /// Como fica guardada no banco: igual ao JSON.
    pub fn como_texto(self) -> &'static str {
        match self {
            Self::Facil => "facil",
            Self::Medio => "medio",
            Self::Dificil => "dificil",
            Self::Expert => "expert",
        }
    }

    fn base(self) -> f64 {
        match self {
            Self::Facil => 50.0,
            Self::Medio => 100.0,
            Self::Dificil => 160.0,
            Self::Expert => 240.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ResumoDaPartida {
    pub dificuldade: Dificuldade,
    pub acertos: u32,
    pub total: u32,
    pub derrota: bool,
    pub fantasma: bool,
}

#[derive(Debug, thiserror::Error, PartialEq)]
pub enum PartidaInvalida {
    #[error("a partida precisa ter entre 1 e {MAXIMO_DE_NOTAS} notas")]
    TotalForaDaFaixa,
    #[error("os acertos passam do total de notas")]
    AcertosDemais,
}

/// Bem acima do chart mais longo; acima disso é cliente mentindo.
pub const MAXIMO_DE_NOTAS: u32 = 10_000;
/// Uma música de tamanho comum. Mais curta rende menos, mais longa rende um pouco mais.
const NOTAS_DE_REFERENCIA: f64 = 400.0;

impl ResumoDaPartida {
    pub fn validar(self) -> Result<Self, PartidaInvalida> {
        if self.total == 0 || self.total > MAXIMO_DE_NOTAS {
            return Err(PartidaInvalida::TotalForaDaFaixa);
        }
        if self.acertos > self.total {
            return Err(PartidaInvalida::AcertosDemais);
        }
        Ok(self)
    }

    fn precisao(self) -> f64 {
        f64::from(self.acertos) / f64::from(self.total)
    }
}

/// XP de uma partida: a dificuldade dá a base, a precisão vale de 50% a 150%
/// e o tamanho da música de 25% a 150%. Ser vaiado ainda rende um pouco.
pub fn xp_da_partida(partida: ResumoDaPartida) -> u64 {
    let tamanho = (f64::from(partida.total) / NOTAS_DE_REFERENCIA).clamp(0.25, 1.5);
    let castigo = if partida.derrota {
        0.25
    } else if partida.fantasma {
        0.5
    } else {
        1.0
    };
    (partida.dificuldade.base() * (0.5 + partida.precisao()) * tamanho * castigo).round() as u64
}

/// XP para sair do nível `nivel` e chegar no seguinte. Cresce a cada nível.
pub fn xp_para_subir(nivel: u32) -> u64 {
    (100.0 * f64::from(nivel).powf(1.5)).round() as u64
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub struct Nivel {
    pub nivel: u32,
    pub xp_no_nivel: u64,
    pub xp_para_o_proximo: u64,
}

/// O nível não é guardado: sai do XP total, então mudar a curva recalcula todo mundo.
pub fn nivel_do_xp(xp_total: u64) -> Nivel {
    let mut nivel = 1;
    let mut restante = xp_total;
    while restante >= xp_para_subir(nivel) {
        restante -= xp_para_subir(nivel);
        nivel += 1;
    }
    Nivel {
        nivel,
        xp_no_nivel: restante,
        xp_para_o_proximo: xp_para_subir(nivel),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_dificuldade_vira_o_mesmo_texto_do_json() {
        for dificuldade in [Dificuldade::Facil, Dificuldade::Medio, Dificuldade::Dificil, Dificuldade::Expert] {
            assert_eq!(serde_json::to_value(dificuldade).unwrap(), dificuldade.como_texto());
        }
    }

    fn partida(dificuldade: Dificuldade, acertos: u32, total: u32) -> ResumoDaPartida {
        ResumoDaPartida {
            dificuldade,
            acertos,
            total,
            derrota: false,
            fantasma: false,
        }
    }

    #[test]
    fn dificuldade_maior_rende_mais() {
        let facil = xp_da_partida(partida(Dificuldade::Facil, 400, 400));
        let expert = xp_da_partida(partida(Dificuldade::Expert, 400, 400));
        assert!(expert > facil);
    }

    #[test]
    fn precisao_maior_rende_mais() {
        assert_eq!(xp_da_partida(partida(Dificuldade::Medio, 400, 400)), 150);
        assert_eq!(xp_da_partida(partida(Dificuldade::Medio, 200, 400)), 100);
        assert_eq!(xp_da_partida(partida(Dificuldade::Medio, 0, 400)), 50);
    }

    #[test]
    fn musica_curta_rende_menos_e_longa_tem_teto() {
        assert_eq!(xp_da_partida(partida(Dificuldade::Medio, 10, 10)), 38);
        assert_eq!(xp_da_partida(partida(Dificuldade::Medio, 5000, 5000)), 225);
    }

    #[test]
    fn vaia_e_fantasma_rendem_menos() {
        let normal = partida(Dificuldade::Medio, 400, 400);
        assert_eq!(xp_da_partida(ResumoDaPartida { derrota: true, ..normal }), 38);
        assert_eq!(xp_da_partida(ResumoDaPartida { fantasma: true, ..normal }), 75);
    }

    #[test]
    fn recusa_partidas_impossiveis() {
        assert_eq!(partida(Dificuldade::Medio, 1, 0).validar(), Err(PartidaInvalida::TotalForaDaFaixa));
        assert_eq!(
            partida(Dificuldade::Medio, 1, MAXIMO_DE_NOTAS + 1).validar(),
            Err(PartidaInvalida::TotalForaDaFaixa)
        );
        assert_eq!(partida(Dificuldade::Medio, 11, 10).validar(), Err(PartidaInvalida::AcertosDemais));
        assert!(partida(Dificuldade::Medio, 10, 10).validar().is_ok());
    }

    #[test]
    fn cada_nivel_pede_mais_xp_que_o_anterior() {
        assert_eq!(xp_para_subir(1), 100);
        assert_eq!(xp_para_subir(10), 3162);
        assert!((1..100).all(|n| xp_para_subir(n + 1) > xp_para_subir(n)));
    }

    #[test]
    fn nivel_sai_do_xp_total() {
        assert_eq!(
            nivel_do_xp(0),
            Nivel {
                nivel: 1,
                xp_no_nivel: 0,
                xp_para_o_proximo: 100
            }
        );
        assert_eq!(nivel_do_xp(99).nivel, 1);
        assert_eq!(
            nivel_do_xp(100),
            Nivel {
                nivel: 2,
                xp_no_nivel: 0,
                xp_para_o_proximo: 283
            }
        );
        assert_eq!(
            nivel_do_xp(100 + 283 + 10),
            Nivel {
                nivel: 3,
                xp_no_nivel: 10,
                xp_para_o_proximo: 520
            }
        );
    }

    #[test]
    fn dificuldade_vem_do_json_como_no_jogo() {
        let d: Dificuldade = serde_json::from_str("\"expert\"").unwrap();
        assert_eq!(d, Dificuldade::Expert);
    }
}
