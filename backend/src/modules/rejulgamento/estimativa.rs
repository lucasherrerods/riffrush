//! Estimativa da precisão no ScoreV1 para partidas antigas que perderam o replay.
//!
//! O banco só guarda a soma do valor dos acertos, não o tempo de cada nota. Os julgamentos antigos tinham
//! faixas fixas (PERFEITO até 35 ms, ÓTIMO até 70 ms, BOM até 110 ms), então cada um vira, em média, um valor
//! do ScoreV1 se os acertos se espalham por igual dentro da faixa:
//! - PERFEITO cabe inteiro no 300 (até 40 ms);
//! - ÓTIMO: de 35 a 40 ms é 300 e de 40 a 70 ms é 200;
//! - BOM: de 70 a 73 ms é 200, de 73 a 103 ms é 100 e de 103 a 110 ms é 50.
//!
//! Com só a soma, não dá para separar quantos foram ÓTIMO e quantos BOM; a estimativa divide os que não foram
//! PERFEITO entre os dois na proporção das faixas (35 ms para 40 ms).

/// Os pesos com que a partida foi julgada, que mudaram com o tempo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PesosAntigos {
    /// PERFEITO 300, ÓTIMO 100, BOM 50: as partidas até 27/10/2026.
    Primeiros,
    /// PERFEITO 300, ÓTIMO 200, BOM 100: de 27/10 até o ScoreV1.
    Segundos,
}

use chrono::{DateTime, TimeZone, Utc};

/// Quando os pesos passaram a 300/200/100 (merge do PR que trocou os pesos, em 27/10/2026 às 15h05 de Brasília).
fn inicio_dos_segundos_pesos() -> DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 10, 27, 18, 5, 22).single().unwrap_or(DateTime::<Utc>::MIN_UTC)
}

/// Os pesos com que a partida foi guardada. A que o servidor já rejulgou com as regras do Clone Hero
/// foi refeita com 300/200/100, mesmo que tenha sido jogada antes.
pub fn pesos_da_partida(rejulgada_no_clone_hero: bool, jogada_em: DateTime<Utc>) -> PesosAntigos {
    if rejulgada_no_clone_hero || jogada_em >= inicio_dos_segundos_pesos() {
        PesosAntigos::Segundos
    } else {
        PesosAntigos::Primeiros
    }
}

const PERFEITO: f64 = 300.0;
/// A faixa do ÓTIMO (35 a 70 ms) e a do BOM (70 a 110 ms), em ms.
const FAIXA_DO_OTIMO: f64 = 35.0;
const FAIXA_DO_BOM: f64 = 40.0;
/// O valor médio de cada julgamento antigo no ScoreV1.
const OTIMO_NO_SCORE_V1: f64 = (5.0 * 300.0 + 30.0 * 200.0) / FAIXA_DO_OTIMO;
const BOM_NO_SCORE_V1: f64 = (3.0 * 200.0 + 30.0 * 100.0 + 7.0 * 50.0) / FAIXA_DO_BOM;

/// O valor médio de um acerto que não foi PERFEITO, com os valores de ÓTIMO e BOM dados.
fn media_dos_outros(otimo: f64, bom: f64) -> f64 {
    (FAIXA_DO_OTIMO * otimo + FAIXA_DO_BOM * bom) / (FAIXA_DO_OTIMO + FAIXA_DO_BOM)
}

/// O valor dos acertos no ScoreV1 estimado pelo valor guardado com os pesos antigos.
/// Sem o valor (apps bem antigos), cada acerto já contava como PERFEITO, e continua assim.
pub fn estimar_valor_no_score_v1(acertos: u32, valor_antigo: Option<u32>, pesos: PesosAntigos) -> u32 {
    let maximo = f64::from(acertos) * PERFEITO;
    let Some(valor) = valor_antigo else {
        return maximo as u32;
    };
    let antes = match pesos {
        PesosAntigos::Primeiros => media_dos_outros(100.0, 50.0),
        PesosAntigos::Segundos => media_dos_outros(200.0, 100.0),
    };
    let depois = media_dos_outros(OTIMO_NO_SCORE_V1, BOM_NO_SCORE_V1);
    let acertos = f64::from(acertos);
    let perfeitos = ((f64::from(valor) - antes * acertos) / (PERFEITO - antes)).clamp(0.0, acertos);
    let estimado = perfeitos * PERFEITO + (acertos - perfeitos) * depois;
    estimado.round().clamp(0.0, maximo) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn os_pesos_vem_da_data_ou_do_rejulgamento_do_clone_hero() {
        let antes = Utc.with_ymd_and_hms(2026, 10, 26, 12, 0, 0).unwrap();
        let depois = Utc.with_ymd_and_hms(2026, 10, 28, 12, 0, 0).unwrap();
        assert_eq!(pesos_da_partida(false, antes), PesosAntigos::Primeiros);
        assert_eq!(pesos_da_partida(false, depois), PesosAntigos::Segundos);
        assert_eq!(pesos_da_partida(true, antes), PesosAntigos::Segundos);
    }

    #[test]
    fn so_perfeitos_continuam_com_o_valor_maximo() {
        assert_eq!(estimar_valor_no_score_v1(100, Some(30_000), PesosAntigos::Primeiros), 30_000);
        assert_eq!(estimar_valor_no_score_v1(100, Some(30_000), PesosAntigos::Segundos), 30_000);
    }

    #[test]
    fn sem_o_valor_cada_acerto_continua_contando_como_perfeito() {
        assert_eq!(estimar_valor_no_score_v1(80, None, PesosAntigos::Primeiros), 24_000);
    }

    #[test]
    fn nos_pesos_de_300_200_100_a_estimativa_fica_perto_do_valor_antigo() {
        let antigo = 25_000;
        let estimado = estimar_valor_no_score_v1(100, Some(antigo), PesosAntigos::Segundos);
        assert!((estimado as i64 - antigo as i64).abs() < 500, "{estimado}");
    }

    #[test]
    fn nos_primeiros_pesos_o_otimo_e_o_bom_valiam_menos_e_a_estimativa_sobe() {
        // Só ÓTIMO valia 100 cada; no ScoreV1 a média dos que não foram PERFEITO passa de 150.
        let estimado = estimar_valor_no_score_v1(100, Some(10_000), PesosAntigos::Primeiros);
        assert!((15_000..20_000).contains(&estimado), "{estimado}");
    }

    #[test]
    fn nunca_passa_do_maximo_nem_fica_negativo() {
        assert_eq!(estimar_valor_no_score_v1(10, Some(9_999), PesosAntigos::Segundos), 3_000);
        assert!(estimar_valor_no_score_v1(10, Some(0), PesosAntigos::Segundos) <= 3_000);
        assert_eq!(estimar_valor_no_score_v1(0, Some(0), PesosAntigos::Primeiros), 0);
    }

    #[test]
    fn mais_valor_antigo_nunca_da_menos_valor_estimado() {
        let mut anterior = 0;
        for valor in (0..=30_000).step_by(500) {
            let estimado = estimar_valor_no_score_v1(100, Some(valor), PesosAntigos::Primeiros);
            assert!(estimado >= anterior);
            anterior = estimado;
        }
    }
}
