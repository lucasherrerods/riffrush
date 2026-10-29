//! Regras de XP e nível. Só o servidor calcula: o cliente manda o resumo da partida e recebe o XP.

use riffrush_motor::Julgamento;

/// Em ordem: a comparação diz qual é a mais difícil.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, serde::Deserialize, serde::Serialize)]
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

    pub fn do_texto(texto: &str) -> Option<Self> {
        [Self::Facil, Self::Medio, Self::Dificil, Self::Expert]
            .into_iter()
            .find(|d| d.como_texto() == texto)
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

/// O instrumento tocado. Cada um tem o próprio ranking; o XP não muda com ele.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Instrumento {
    /// O padrão: o jogo antes dos instrumentos só tinha a guitarra.
    #[default]
    Guitarra,
    Baixo,
    Ritmica,
    Coop,
    Teclado,
}

impl Instrumento {
    /// Como fica guardado no banco: igual ao JSON.
    pub fn como_texto(self) -> &'static str {
        match self {
            Self::Guitarra => "guitarra",
            Self::Baixo => "baixo",
            Self::Ritmica => "ritmica",
            Self::Coop => "coop",
            Self::Teclado => "teclado",
        }
    }

    pub fn do_texto(texto: &str) -> Option<Self> {
        [Self::Guitarra, Self::Baixo, Self::Ritmica, Self::Coop, Self::Teclado]
            .into_iter()
            .find(|i| i.como_texto() == texto)
    }
}

/// Como as teclas viraram notas na partida. Não muda o XP; aparece no ranking.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum JeitoDeJogar {
    Tapping,
    #[default]
    Gamepad,
    Palhetada,
}

impl JeitoDeJogar {
    /// Como fica guardado no banco: igual ao JSON.
    pub fn como_texto(self) -> &'static str {
        match self {
            Self::Tapping => "tapping",
            Self::Gamepad => "gamepad",
            Self::Palhetada => "palhetada",
        }
    }

    pub fn do_texto(texto: &str) -> Option<Self> {
        [Self::Tapping, Self::Gamepad, Self::Palhetada].into_iter().find(|j| j.como_texto() == texto)
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ResumoDaPartida {
    pub dificuldade: Dificuldade,
    pub acertos: u32,
    pub total: u32,
    pub derrota: bool,
    pub fantasma: bool,
    /// Apps antigos não mandam.
    pub maior_sequencia: Option<u32>,
    /// Soma do valor de cada acerto pelo julgamento (PERFEITO, ÓTIMO, BOM). Apps antigos não mandam.
    pub valor_dos_acertos: Option<u32>,
}

#[derive(Debug, thiserror::Error, PartialEq)]
pub enum PartidaInvalida {
    #[error("a partida precisa ter entre 1 e {MAXIMO_DE_NOTAS} notas")]
    TotalForaDaFaixa,
    #[error("os acertos passam do total de notas")]
    AcertosDemais,
    #[error("a maior sequência passa dos acertos")]
    SequenciaDemais,
    #[error("o valor dos acertos não bate com os julgamentos possíveis")]
    ValorDosAcertosForaDaFaixa,
    #[error("o replay é inválido")]
    ReplayInvalido,
}

/// O app manda a versão do formato no primeiro byte, fora da compressão.
/// A 2 trouxe a nota aberta e a 3, a velocidade da música; os replays antigos continuam guardados e valendo.
pub const VERSOES_DO_REPLAY: [u8; 3] = [1, 2, 3];
/// Uma música inteira fica com menos de 10 KB; o limite deixa folga sem abrir espaço para abuso.
pub const TAMANHO_MAXIMO_DO_REPLAY: usize = 64 * 1024;

/// A API não abre o replay: confere só o tamanho e a versão.
pub fn validar_replay(bytes: &[u8]) -> Result<(), PartidaInvalida> {
    if bytes.len() < 2 || bytes.len() > TAMANHO_MAXIMO_DO_REPLAY || !VERSOES_DO_REPLAY.contains(&bytes[0]) {
        return Err(PartidaInvalida::ReplayInvalido);
    }
    Ok(())
}

/// Bem acima do chart mais longo; acima disso é cliente mentindo.
pub const MAXIMO_DE_NOTAS: u32 = 10_000;
/// Uma música de tamanho comum. Mais curta rende menos, mais longa rende um pouco mais.
const NOTAS_DE_REFERENCIA: f64 = 400.0;
/// Ajuste geral do ritmo: a fórmula dava XP demais e os níveis subiam rápido. Vale só para as partidas novas.
const RITMO_DO_XP: f64 = 0.5;

impl ResumoDaPartida {
    pub fn validar(self) -> Result<Self, PartidaInvalida> {
        if self.total == 0 || self.total > MAXIMO_DE_NOTAS {
            return Err(PartidaInvalida::TotalForaDaFaixa);
        }
        if self.acertos > self.total {
            return Err(PartidaInvalida::AcertosDemais);
        }
        if self.maior_sequencia.is_some_and(|s| s > self.acertos) {
            return Err(PartidaInvalida::SequenciaDemais);
        }
        let faixa = self.acertos * Julgamento::Bom.valor()..=self.acertos * Julgamento::Perfeito.valor();
        if self.valor_dos_acertos.is_some_and(|v| !faixa.contains(&v)) {
            return Err(PartidaInvalida::ValorDosAcertosForaDaFaixa);
        }
        Ok(self)
    }

    /// De 0 a 1, como no jogo: cada nota pesa pelo julgamento, e só PERFEITO em todas dá 100%.
    pub fn precisao(&self) -> f64 {
        precisao_pelo_valor(u64::from(self.valor_dos_acertos()), u64::from(self.total))
    }

    /// Sem o valor (apps antigos), cada acerto conta como perfeito.
    pub fn valor_dos_acertos(&self) -> u32 {
        self.valor_dos_acertos.unwrap_or(self.acertos * Julgamento::Perfeito.valor())
    }
}

/// A precisão de várias notas somadas: o valor dos acertos sobre o máximo possível.
pub fn precisao_pelo_valor(valor_dos_acertos: u64, notas: u64) -> f64 {
    if notas == 0 {
        return 0.0;
    }
    valor_dos_acertos as f64 / (notas as f64 * f64::from(Julgamento::Perfeito.valor()))
}

/// Abaixo disso de precisão a partida não rende XP: passar a música sem tocar não conta.
const PRECISAO_MINIMA: f64 = 0.4;
/// Chart curto demais para valer XP.
pub const MINIMO_DE_NOTAS_PARA_XP: u32 = 50;

/// De 0 a 1,5: zero até a precisão mínima (40%), depois cresce mais que linear, para premiar quem joga bem.
fn curva_da_precisao(precisao: f64) -> f64 {
    if precisao < PRECISAO_MINIMA {
        return 0.0;
    }
    let acima = (precisao.min(1.0) - PRECISAO_MINIMA) / (1.0 - PRECISAO_MINIMA);
    1.5 * acima * acima
}

/// Repetir o mesmo chart várias vezes no dia rende cada vez menos. `repeticoes` é quantas
/// partidas o jogador já fez nele nas últimas 24 horas, em qualquer dificuldade.
fn peso_da_repeticao(repeticoes: u32) -> f64 {
    match repeticoes {
        0 | 1 => 1.0,
        2 => 0.7,
        3 => 0.5,
        _ => 0.25,
    }
}

/// XP de uma partida que o servidor rejulgou: a dificuldade dá a base, a precisão (pelo valor de cada nota)
/// a curva, e a música mais longa rende mais, pela raiz do número de notas. Vaia e fantasma rendem menos,
/// e o mesmo chart repetido no dia também. Tudo vezes `RITMO_DO_XP`.
pub fn xp_da_partida(partida: ResumoDaPartida, precisao: f64, repeticoes: u32) -> u64 {
    let castigo = if partida.derrota {
        0.25
    } else if partida.fantasma {
        0.5
    } else {
        1.0
    };
    xp_pelos_numeros(partida.dificuldade.base(), partida.total, precisao, castigo, repeticoes)
}

/// A mesma fórmula para quem tem os números soltos (o Mania): a base da dificuldade, o número de notas, a precisão,
/// o castigo (1 sem castigo) e as repetições do dia.
pub fn xp_pelos_numeros(base: f64, notas: u32, precisao: f64, castigo: f64, repeticoes: u32) -> u64 {
    if notas < MINIMO_DE_NOTAS_PARA_XP {
        return 0;
    }
    let tamanho = (f64::from(notas) / NOTAS_DE_REFERENCIA).sqrt().clamp(0.25, 1.5);
    (base * curva_da_precisao(precisao) * tamanho * castigo * peso_da_repeticao(repeticoes) * RITMO_DO_XP).round() as u64
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
            assert_eq!(Dificuldade::do_texto(dificuldade.como_texto()), Some(dificuldade));
        }
        assert_eq!(Dificuldade::do_texto("impossivel"), None);
    }

    #[test]
    fn o_instrumento_volta_do_texto_do_banco() {
        for instrumento in [
            Instrumento::Guitarra,
            Instrumento::Baixo,
            Instrumento::Ritmica,
            Instrumento::Coop,
            Instrumento::Teclado,
        ] {
            assert_eq!(Instrumento::do_texto(instrumento.como_texto()), Some(instrumento));
        }
        assert_eq!(Instrumento::do_texto("bateria"), None);
    }

    fn partida(dificuldade: Dificuldade, acertos: u32, total: u32) -> ResumoDaPartida {
        ResumoDaPartida {
            dificuldade,
            acertos,
            total,
            derrota: false,
            fantasma: false,
            maior_sequencia: None,
            valor_dos_acertos: None,
        }
    }

    #[test]
    fn dificuldade_maior_rende_mais() {
        let facil = xp_da_partida(partida(Dificuldade::Facil, 400, 400), 1.0, 0);
        let expert = xp_da_partida(partida(Dificuldade::Expert, 400, 400), 1.0, 0);
        assert!(expert > facil);
    }

    #[test]
    fn a_precisao_cresce_mais_que_linear_e_abaixo_de_40_por_cento_nao_rende() {
        let medio = partida(Dificuldade::Medio, 400, 400);
        assert_eq!(xp_da_partida(medio, 1.0, 0), 75);
        assert_eq!(xp_da_partida(medio, 0.75, 0), 26);
        assert_eq!(xp_da_partida(medio, 0.5, 0), 2);
        assert_eq!(xp_da_partida(medio, 0.4, 0), 0);
        assert_eq!(xp_da_partida(medio, 0.3, 0), 0);
    }

    #[test]
    fn musica_longa_rende_pela_raiz_das_notas_com_teto_e_curta_demais_nao_rende() {
        assert_eq!(xp_da_partida(partida(Dificuldade::Medio, 100, 100), 1.0, 0), 38);
        assert_eq!(xp_da_partida(partida(Dificuldade::Medio, 1600, 1600), 1.0, 0), 113);
        assert_eq!(xp_da_partida(partida(Dificuldade::Medio, 49, 49), 1.0, 0), 0);
    }

    #[test]
    fn repetir_o_chart_no_dia_rende_cada_vez_menos() {
        let medio = partida(Dificuldade::Medio, 400, 400);
        assert_eq!(xp_da_partida(medio, 1.0, 1), 75);
        assert_eq!(xp_da_partida(medio, 1.0, 2), 53);
        assert_eq!(xp_da_partida(medio, 1.0, 3), 38);
        assert_eq!(xp_da_partida(medio, 1.0, 10), 19);
    }

    #[test]
    fn vaia_e_fantasma_rendem_menos() {
        let normal = partida(Dificuldade::Medio, 400, 400);
        assert_eq!(xp_da_partida(ResumoDaPartida { derrota: true, ..normal }, 1.0, 0), 19);
        assert_eq!(xp_da_partida(ResumoDaPartida { fantasma: true, ..normal }, 1.0, 0), 38);
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
    fn recusa_sequencia_maior_que_os_acertos() {
        let com_sequencia = |s| ResumoDaPartida {
            maior_sequencia: Some(s),
            ..partida(Dificuldade::Medio, 8, 10)
        };
        assert_eq!(com_sequencia(9).validar(), Err(PartidaInvalida::SequenciaDemais));
        assert!(com_sequencia(8).validar().is_ok());
    }

    #[test]
    fn recusa_valor_dos_acertos_fora_do_que_os_julgamentos_permitem() {
        let com_valor = |v| ResumoDaPartida {
            valor_dos_acertos: Some(v),
            ..partida(Dificuldade::Medio, 8, 10)
        };
        // Oito acertos valem de 8 BONS (800) a 8 PERFEITOS (2400).
        assert_eq!(com_valor(2401).validar(), Err(PartidaInvalida::ValorDosAcertosForaDaFaixa));
        assert_eq!(com_valor(799).validar(), Err(PartidaInvalida::ValorDosAcertosForaDaFaixa));
        assert!(com_valor(800).validar().is_ok());
        assert!(com_valor(2400).validar().is_ok());
    }

    #[test]
    fn precisao_pesa_o_julgamento_de_cada_nota_como_no_jogo() {
        let so_otimos = ResumoDaPartida {
            valor_dos_acertos: Some(10 * 200),
            ..partida(Dificuldade::Medio, 10, 10)
        };
        assert!((so_otimos.precisao() - 2.0 / 3.0).abs() < 1e-9);
        // Apps antigos não mandam o valor: cada acerto conta como perfeito, o cálculo de antes.
        assert!((partida(Dificuldade::Medio, 5, 10).precisao() - 0.5).abs() < 1e-9);
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
    fn o_instrumento_vira_o_mesmo_texto_do_json() {
        for instrumento in [
            Instrumento::Guitarra,
            Instrumento::Baixo,
            Instrumento::Ritmica,
            Instrumento::Coop,
            Instrumento::Teclado,
        ] {
            assert_eq!(serde_json::to_value(instrumento).unwrap(), instrumento.como_texto());
        }
        assert_eq!(Instrumento::default(), Instrumento::Guitarra);
    }

    #[test]
    fn dificuldade_vem_do_json_como_no_jogo() {
        let d: Dificuldade = serde_json::from_str("\"expert\"").unwrap();
        assert_eq!(d, Dificuldade::Expert);
    }

    #[test]
    fn replay_precisa_da_versao_certa_e_caber_no_limite() {
        assert!(validar_replay(&[1, 0, 1]).is_ok());
        assert!(validar_replay(&[2, 0, 1]).is_ok());
        assert!(validar_replay(&[3, 0, 1]).is_ok());
        assert_eq!(validar_replay(&[4, 0, 1]), Err(PartidaInvalida::ReplayInvalido));
        assert_eq!(validar_replay(&[2]), Err(PartidaInvalida::ReplayInvalido));
        assert_eq!(validar_replay(&[9, 0, 1]), Err(PartidaInvalida::ReplayInvalido));
        let grande = vec![2; TAMANHO_MAXIMO_DO_REPLAY + 1];
        assert_eq!(validar_replay(&grande), Err(PartidaInvalida::ReplayInvalido));
    }
}
