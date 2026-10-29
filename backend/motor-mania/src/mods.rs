//! Os mods do Mania: mudam janelas, velocidade, vida, colunas ou só o desenho da pista.
//! Vão no replay como um número (um bit por mod), para a API rejulgar com os mesmos.

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Hash)]
pub struct Mods(pub u32);

impl Mods {
    pub const NENHUM: Mods = Mods(0);
    /// Easy: janelas 1,4 vez mais largas e metade da perda de vida.
    pub const EZ: Mods = Mods(1);
    /// No Fail: a vida zerada não tira da música.
    pub const NF: Mods = Mods(1 << 1);
    /// Half Time: música a 0,75x.
    pub const HT: Mods = Mods(1 << 2);
    /// Hard Rock: janelas 1,4 vez mais estreitas.
    pub const HR: Mods = Mods(1 << 3);
    /// Double Time: música a 1,5x.
    pub const DT: Mods = Mods(1 << 4);
    /// Nightcore: o DT com o tom da música mais agudo. Mesmas regras do DT.
    pub const NC: Mods = Mods(1 << 5);
    /// Sudden Death: o primeiro Miss é derrota.
    pub const SD: Mods = Mods(1 << 6);
    /// Perfect: qualquer julgamento abaixo do MAX é derrota.
    pub const PF: Mods = Mods(1 << 7);
    /// Fade In, Hidden e Flashlight: só escondem notas no desenho; as regras não mudam.
    pub const FI: Mods = Mods(1 << 8);
    pub const HD: Mods = Mods(1 << 9);
    pub const FL: Mods = Mods(1 << 10);
    /// Espelha as colunas.
    pub const MIRROR: Mods = Mods(1 << 11);
    /// Embaralha as colunas, com a semente gravada no replay.
    pub const RANDOM: Mods = Mods(1 << 12);
    /// O jogo toca sozinho.
    pub const AUTOPLAY: Mods = Mods(1 << 13);

    const TODOS: [(Mods, &'static str); 14] = [
        (Mods::EZ, "EZ"),
        (Mods::NF, "NF"),
        (Mods::HT, "HT"),
        (Mods::HR, "HR"),
        (Mods::DT, "DT"),
        (Mods::NC, "NC"),
        (Mods::SD, "SD"),
        (Mods::PF, "PF"),
        (Mods::FI, "FI"),
        (Mods::HD, "HD"),
        (Mods::FL, "FL"),
        (Mods::MIRROR, "MR"),
        (Mods::RANDOM, "RD"),
        (Mods::AUTOPLAY, "AT"),
    ];

    /// Pares que não fazem sentido juntos.
    const CONFLITOS: [(Mods, Mods); 9] = [
        (Mods::EZ, Mods::HR),
        (Mods::HT, Mods::DT),
        (Mods::HT, Mods::NC),
        (Mods::NF, Mods::SD),
        (Mods::NF, Mods::PF),
        (Mods::SD, Mods::PF),
        (Mods::FI, Mods::HD),
        (Mods::MIRROR, Mods::RANDOM),
        (Mods::AUTOPLAY, Mods::NF),
    ];

    pub const fn com(self, outro: Mods) -> Mods {
        Mods(self.0 | outro.0)
    }

    pub const fn tem(self, mod_: Mods) -> bool {
        self.0 & mod_.0 == mod_.0
    }

    /// Velocidade da música.
    pub fn velocidade(self) -> f64 {
        if self.tem(Mods::DT) || self.tem(Mods::NC) {
            1.5
        } else if self.tem(Mods::HT) {
            0.75
        } else {
            1.0
        }
    }

    /// Quanto as janelas crescem (EZ) ou encolhem (HR), no tempo da música.
    pub fn fator_das_janelas(self) -> f64 {
        if self.tem(Mods::EZ) {
            1.4
        } else if self.tem(Mods::HR) {
            1.0 / 1.4
        } else {
            1.0
        }
    }

    /// Os mods que facilitam reduzem a pontuação; os que dificultam não aumentam.
    pub fn multiplicador(self) -> f64 {
        [Mods::EZ, Mods::NF, Mods::HT]
            .iter()
            .filter(|&&m| self.tem(m))
            .fold(1.0, |total, _| total * 0.5)
    }

    /// Random e Autoplay não entram no ranking.
    pub fn vale_ranking(self) -> bool {
        !self.tem(Mods::RANDOM) && !self.tem(Mods::AUTOPLAY)
    }

    /// Recusa bits desconhecidos e pares em conflito.
    pub fn validar(self) -> Result<(), ErroDosMods> {
        let conhecidos = Mods::TODOS.iter().fold(0, |bits, (m, _)| bits | m.0);
        if self.0 & !conhecidos != 0 {
            return Err(ErroDosMods::Desconhecido(self.0 & !conhecidos));
        }
        match Mods::CONFLITOS.iter().find(|(a, b)| self.tem(*a) && self.tem(*b)) {
            Some(&(a, b)) => Err(ErroDosMods::Conflito(a.sigla(), b.sigla())),
            None => Ok(()),
        }
    }

    fn sigla(self) -> &'static str {
        Mods::TODOS.iter().find(|(m, _)| *m == self).map_or("?", |(_, s)| s)
    }

    /// As siglas dos mods ligados, na ordem do osu!.
    pub fn siglas(self) -> Vec<&'static str> {
        Mods::TODOS.iter().filter(|(m, _)| self.tem(*m)).map(|(_, s)| *s).collect()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ErroDosMods {
    Desconhecido(u32),
    Conflito(&'static str, &'static str),
}

/// Para cada coluna do mapa, a coluna em que ela é tocada. Sem Mirror nem Random, é a mesma.
pub fn colunas_com_mods(teclas: u8, mods: Mods, semente: u32) -> Vec<u8> {
    let mut colunas: Vec<u8> = (0..teclas).collect();
    if mods.tem(Mods::MIRROR) {
        colunas.reverse();
    } else if mods.tem(Mods::RANDOM) {
        // Fisher-Yates com um xorshift: o mesmo embaralhamento no app e na API para a mesma semente.
        let mut estado = semente.max(1);
        for i in (1..colunas.len()).rev() {
            estado ^= estado << 13;
            estado ^= estado >> 17;
            estado ^= estado << 5;
            colunas.swap(i, (estado as usize) % (i + 1));
        }
    }
    colunas
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn velocidade_e_janelas_pelos_mods() {
        assert_eq!(Mods::NENHUM.velocidade(), 1.0);
        assert_eq!(Mods::DT.velocidade(), 1.5);
        assert_eq!(Mods::NC.velocidade(), 1.5);
        assert_eq!(Mods::HT.velocidade(), 0.75);
        assert_eq!(Mods::EZ.fator_das_janelas(), 1.4);
        assert_eq!(Mods::HR.fator_das_janelas(), 1.0 / 1.4);
    }

    #[test]
    fn multiplicador_reduz_so_com_os_mods_que_facilitam() {
        assert_eq!(Mods::NENHUM.multiplicador(), 1.0);
        assert_eq!(Mods::HR.com(Mods::DT).com(Mods::HD).multiplicador(), 1.0);
        assert_eq!(Mods::EZ.multiplicador(), 0.5);
        assert_eq!(Mods::EZ.com(Mods::NF).com(Mods::HT).multiplicador(), 0.125);
    }

    #[test]
    fn random_e_autoplay_nao_valem_ranking() {
        assert!(Mods::HR.com(Mods::DT).vale_ranking());
        assert!(!Mods::RANDOM.vale_ranking());
        assert!(!Mods::AUTOPLAY.vale_ranking());
    }

    #[test]
    fn valida_bits_e_conflitos() {
        assert_eq!(Mods::HR.com(Mods::DT).com(Mods::SD).validar(), Ok(()));
        assert_eq!(Mods::EZ.com(Mods::HR).validar(), Err(ErroDosMods::Conflito("EZ", "HR")));
        assert_eq!(Mods::NF.com(Mods::PF).validar(), Err(ErroDosMods::Conflito("NF", "PF")));
        assert_eq!(Mods(1 << 20).validar(), Err(ErroDosMods::Desconhecido(1 << 20)));
    }

    #[test]
    fn siglas_na_ordem() {
        assert_eq!(Mods::HD.com(Mods::DT).com(Mods::MIRROR).siglas(), ["DT", "HD", "MR"]);
    }

    #[test]
    fn mirror_espelha_e_random_embaralha_igual_para_a_mesma_semente() {
        assert_eq!(colunas_com_mods(4, Mods::NENHUM, 0), [0, 1, 2, 3]);
        assert_eq!(colunas_com_mods(4, Mods::MIRROR, 0), [3, 2, 1, 0]);
        let a = colunas_com_mods(7, Mods::RANDOM, 42);
        assert_eq!(a, colunas_com_mods(7, Mods::RANDOM, 42));
        let mut ordenadas = a.clone();
        ordenadas.sort_unstable();
        assert_eq!(ordenadas, [0, 1, 2, 3, 4, 5, 6]);
        assert!((1..50).any(|s| colunas_com_mods(7, Mods::RANDOM, s) != a));
    }
}
