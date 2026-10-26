use std::collections::VecDeque;

use chrono::{DateTime, Duration, Utc};
use riffrush_motor as motor;

use crate::modules::progresso::{Dificuldade, Instrumento, ResumoDaPartida};

pub use motor::ChartGuardado;

/// O resultado da partida segundo o servidor, tirado só do replay e do chart.
#[derive(Debug, Clone, PartialEq)]
pub struct Rejulgada {
    pub resumo: ResumoDaPartida,
    pub pontos: u64,
    pub perfeitos: u32,
    pub otimos: u32,
    pub bons: u32,
    /// De 0 a 1, pelo valor de cada nota do chart.
    pub precisao: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum Recusa {
    #[error("replay ilegível")]
    ReplayInvalido,
    #[error("o replay é de outro chart")]
    ChartDiferente,
    #[error("chart ilegível")]
    ChartInvalido,
    #[error("a trilha não tem notas")]
    TrilhaVazia,
}

fn no_motor(instrumento: Instrumento) -> motor::Instrumento {
    match instrumento {
        Instrumento::Guitarra => motor::Instrumento::Guitarra,
        Instrumento::Baixo => motor::Instrumento::Baixo,
        Instrumento::Ritmica => motor::Instrumento::Ritmica,
        Instrumento::Coop => motor::Instrumento::Coop,
        Instrumento::Teclado => motor::Instrumento::Teclado,
    }
}

fn dificuldade_no_motor(dificuldade: Dificuldade) -> motor::Dificuldade {
    match dificuldade {
        Dificuldade::Facil => motor::Dificuldade::Facil,
        Dificuldade::Medio => motor::Dificuldade::Medio,
        Dificuldade::Dificil => motor::Dificuldade::Dificil,
        Dificuldade::Expert => motor::Dificuldade::Expert,
    }
}

/// Toca o replay sobre as notas da trilha, como o app faria ao assistir, até a última nota passar.
pub fn rejulgar(chart: &ChartGuardado, instrumento: Instrumento, dificuldade: Dificuldade, replay: &[u8]) -> Result<Rejulgada, Recusa> {
    let replay = motor::desempacotar_replay(replay).map_err(|_| Recusa::ReplayInvalido)?;
    let notas = motor::notas_do_chart(chart, no_motor(instrumento), dificuldade_no_motor(dificuldade)).map_err(|_| Recusa::ChartInvalido)?;
    if notas.is_empty() {
        return Err(Recusa::TrilhaVazia);
    }
    if motor::hash_do_chart(&notas) != replay.hash_do_chart {
        return Err(Recusa::ChartDiferente);
    }
    let mut partida = motor::criar_partida(
        &notas,
        motor::OpcoesDaPartida {
            sem_falha: replay.sem_falha,
            fantasma: replay.fantasma,
        },
    );
    motor::aplicar_entradas(&mut partida, &replay.entradas);
    let fim = notas.iter().map(|n| n.tempo + n.duracao).fold(f64::MIN, f64::max) + 1.0;
    motor::avancar(&mut partida, fim);

    let total = u32::try_from(notas.len()).unwrap_or(u32::MAX);
    Ok(Rejulgada {
        resumo: ResumoDaPartida {
            dificuldade,
            acertos: partida.acertos,
            total,
            derrota: partida.derrota,
            fantasma: partida.fantasma,
            maior_sequencia: Some(partida.maior_sequencia),
        },
        // Arredonda como o app (`Math.round`); os pontos nunca são negativos.
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        pontos: (partida.pontos + 0.5).floor() as u64,
        perfeitos: partida.perfeitos,
        otimos: partida.otimos,
        bons: partida.bons,
        precisao: f64::from(partida.valor_dos_acertos) / (f64::from(total) * 300.0),
    })
}

/// Depois disso a partida fica marcada como perdida, para alguém olhar o motivo.
pub const MAXIMO_DE_TENTATIVAS: u32 = 20;
const PRIMEIRA_ESPERA: Duration = Duration::minutes(1);
const ESPERA_MAXIMA: Duration = Duration::hours(6);

/// Quanto esperar antes de tentar de novo: dobra a cada tentativa, até 6 horas.
pub fn espera_da_tentativa(tentativas: u32) -> Duration {
    let dobras = tentativas.saturating_sub(1).min(16);
    (PRIMEIRA_ESPERA * 2_i32.pow(dobras)).min(ESPERA_MAXIMA)
}

/// O Encore aceita ~50 pedidos a cada 40 segundos. Fica uma margem para não encostar no limite.
pub const PEDIDOS_AO_ENCORE: usize = 40;
pub const JANELA_DO_ENCORE: Duration = Duration::seconds(40);

/// Conta os pedidos da última janela e diz se cabe mais um.
#[derive(Debug)]
pub struct JanelaDePedidos {
    maximo: usize,
    janela: Duration,
    feitos: VecDeque<DateTime<Utc>>,
}

impl JanelaDePedidos {
    pub fn nova(maximo: usize, janela: Duration) -> Self {
        Self {
            maximo,
            janela,
            feitos: VecDeque::new(),
        }
    }

    /// Anota o pedido e devolve true se ele cabe; sem espaço, não anota nada.
    pub fn pedir(&mut self, agora: DateTime<Utc>) -> bool {
        while self.feitos.front().is_some_and(|&feito| agora - feito >= self.janela) {
            self.feitos.pop_front();
        }
        if self.feitos.len() >= self.maximo {
            return false;
        }
        self.feitos.push_back(agora);
        true
    }
}

#[cfg(test)]
pub mod testes {
    use super::*;

    /// Um chart de 4 notas a 120 BPM, uma por semínima: 0,5 s, 1 s, 1,5 s e 2 s.
    pub fn chart() -> ChartGuardado {
        ChartGuardado {
            arquivo: b"[Song]\n{\n Resolution = 192\n}\n[ExpertSingle]\n{\n192 = N 0 0\n384 = N 1 0\n576 = N 2 0\n768 = N 3 0\n}".to_vec(),
            midi: false,
            atraso_ms: 0.0,
        }
    }

    /// Toca as notas pedidas com o atraso dado, e deixa as outras passarem.
    pub fn replay(chart: &ChartGuardado, toques: &[(usize, f64)]) -> Vec<u8> {
        let notas = motor::notas_do_chart(chart, motor::Instrumento::Guitarra, motor::Dificuldade::Expert).unwrap();
        let mut entradas = Vec::new();
        for &(indice, atraso) in toques {
            let nota = notas[indice];
            entradas.push(motor::Entrada {
                tempo: nota.tempo + atraso,
                tipo: motor::TipoDaEntrada::Tocar,
                pista: nota.pista,
            });
            entradas.push(motor::Entrada {
                tempo: nota.tempo + atraso + 0.05,
                tipo: motor::TipoDaEntrada::Soltar,
                pista: nota.pista,
            });
        }
        motor::empacotar_replay(&motor::Replay {
            sem_falha: false,
            fantasma: false,
            hash_do_chart: motor::hash_do_chart(&notas),
            entradas,
        })
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;

    use super::testes::{chart, replay};
    use super::*;

    #[test]
    fn rejulga_pelo_replay_sem_olhar_o_que_o_app_disse() {
        let chart = chart();
        let rejulgada = rejulgar(
            &chart,
            Instrumento::Guitarra,
            Dificuldade::Expert,
            &replay(&chart, &[(0, 0.0), (1, 0.05), (2, 0.1)]),
        )
        .unwrap();
        assert_eq!((rejulgada.resumo.acertos, rejulgada.resumo.total), (3, 4));
        assert_eq!((rejulgada.perfeitos, rejulgada.otimos, rejulgada.bons), (1, 1, 1));
        assert_eq!(rejulgada.resumo.maior_sequencia, Some(3));
        assert!((rejulgada.precisao - 450.0 / 1200.0).abs() < 1e-9);
        assert_eq!(rejulgada.pontos, 150);
    }

    #[test]
    fn recusa_replay_de_outro_chart_e_replay_ilegivel() {
        let chart = chart();
        let outro = ChartGuardado {
            atraso_ms: 100.0,
            ..chart.clone()
        };
        let do_outro = replay(&outro, &[(0, 0.0)]);
        assert_eq!(
            rejulgar(&chart, Instrumento::Guitarra, Dificuldade::Expert, &do_outro),
            Err(Recusa::ChartDiferente)
        );
        assert_eq!(
            rejulgar(&chart, Instrumento::Guitarra, Dificuldade::Expert, &[2, 1, 2]),
            Err(Recusa::ReplayInvalido)
        );
    }

    #[test]
    fn a_espera_dobra_ate_o_teto() {
        assert_eq!(espera_da_tentativa(1), Duration::minutes(1));
        assert_eq!(espera_da_tentativa(3), Duration::minutes(4));
        assert_eq!(espera_da_tentativa(30), Duration::hours(6));
    }

    #[test]
    fn a_janela_segura_os_pedidos_ate_os_antigos_sairem() {
        let inicio = Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap();
        let mut janela = JanelaDePedidos::nova(2, Duration::seconds(40));
        assert!(janela.pedir(inicio));
        assert!(janela.pedir(inicio + Duration::seconds(1)));
        assert!(!janela.pedir(inicio + Duration::seconds(39)));
        assert!(janela.pedir(inicio + Duration::seconds(40)));
    }
}
