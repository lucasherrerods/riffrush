use chrono::{DateTime, Duration, Utc};
use riffrush_motor as motor;

use crate::modules::progresso::{Dificuldade, Instrumento, JeitoDeJogar, ResumoDaPartida};

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
    /// Jogou com o modificador sem falha: a vida não acaba, então a partida não vale para o ranking.
    pub sem_falha: bool,
    pub jeito_de_jogar: JeitoDeJogar,
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
    #[error("velocidade da música que o jogo não oferece")]
    VelocidadeInvalida,
    #[error("jeito de jogar que essa versão do replay não tem")]
    JeitoDeOutraVersao,
}

/// O jeito de jogar nasceu nessa versão do replay: as anteriores são todas do gamepad.
const VERSAO_COM_JEITO: u8 = 4;

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
pub fn rejulgar(chart: &ChartGuardado, instrumento: Instrumento, dificuldade: Dificuldade, pacote: &[u8]) -> Result<Rejulgada, Recusa> {
    let replay = motor::desempacotar_replay(pacote).map_err(|_| Recusa::ReplayInvalido)?;
    if pacote.first().is_some_and(|&versao| versao < VERSAO_COM_JEITO) && replay.jeito != motor::JeitoDeJogar::Gamepad {
        return Err(Recusa::JeitoDeOutraVersao);
    }
    let notas = motor::notas_do_chart(chart, no_motor(instrumento), dificuldade_no_motor(dificuldade)).map_err(|_| Recusa::ChartInvalido)?;
    if notas.is_empty() {
        return Err(Recusa::TrilhaVazia);
    }
    if !motor::VELOCIDADES.contains(&replay.velocidade) {
        return Err(Recusa::VelocidadeInvalida);
    }
    if motor::hash_do_chart(&notas) != replay.hash_do_chart {
        return Err(Recusa::ChartDiferente);
    }
    let mut partida = motor::criar_partida(
        &notas,
        motor::OpcoesDaPartida {
            sem_falha: replay.sem_falha,
            fantasma: replay.fantasma,
            velocidade: replay.velocidade,
            sem_aberta: replay.sem_aberta,
            jeito: replay.jeito,
            pune_toque_em_vazio: replay.pune_toque_em_vazio,
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
            valor_dos_acertos: Some(partida.valor_dos_acertos),
        },
        // Arredonda como o app (`Math.round`); os pontos nunca são negativos.
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        pontos: (partida.pontos + 0.5).floor() as u64,
        perfeitos: partida.perfeitos,
        otimos: partida.otimos,
        bons: partida.bons,
        precisao: f64::from(partida.valor_dos_acertos) / (f64::from(total) * 300.0),
        sem_falha: replay.sem_falha,
        jeito_de_jogar: match replay.jeito {
            motor::JeitoDeJogar::Tapping => JeitoDeJogar::Tapping,
            motor::JeitoDeJogar::Gamepad => JeitoDeJogar::Gamepad,
            motor::JeitoDeJogar::Palhetada => JeitoDeJogar::Palhetada,
        },
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
/// O limite vale para a API inteira: todas as instâncias contam os pedidos no mesmo lugar.
pub const PEDIDOS_AO_ENCORE: u32 = 40;
pub const JANELA_DO_ENCORE: Duration = Duration::seconds(40);

/// Pedidos feitos antes disso já saíram da janela e não contam mais.
pub fn inicio_da_janela(agora: DateTime<Utc>) -> DateTime<Utc> {
    agora - JANELA_DO_ENCORE
}

/// Com `feitos` pedidos na janela, cabe mais um?
pub fn cabe_mais_um(feitos: u32) -> bool {
    feitos < PEDIDOS_AO_ENCORE
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
        replay_com(chart, toques, false)
    }

    pub fn replay_com(chart: &ChartGuardado, toques: &[(usize, f64)], sem_falha: bool) -> Vec<u8> {
        replay_na_velocidade(chart, toques, sem_falha, 1.0)
    }

    /// Toca na velocidade dada: o toque cai no tempo real da nota, que é o da música dividido pela velocidade.
    pub fn replay_na_velocidade(chart: &ChartGuardado, toques: &[(usize, f64)], sem_falha: bool, velocidade: f64) -> Vec<u8> {
        let notas = motor::notas_do_chart(chart, motor::Instrumento::Guitarra, motor::Dificuldade::Expert).unwrap();
        let mut entradas = Vec::new();
        for &(indice, atraso) in toques {
            let nota = notas[indice];
            entradas.push(motor::Entrada {
                tempo: nota.tempo / velocidade + atraso,
                tipo: motor::TipoDaEntrada::Tocar,
                pista: nota.pista,
            });
            entradas.push(motor::Entrada {
                tempo: nota.tempo / velocidade + atraso + 0.05,
                tipo: motor::TipoDaEntrada::Soltar,
                pista: nota.pista,
            });
        }
        motor::empacotar_replay(&motor::Replay {
            sem_falha,
            fantasma: false,
            sem_aberta: false,
            velocidade,
            jeito: motor::JeitoDeJogar::Gamepad,
            pune_toque_em_vazio: false,
            hash_do_chart: motor::hash_do_chart(&notas),
            entradas,
        })
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;

    use super::testes::{chart, replay, replay_com, replay_na_velocidade};
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
        assert_eq!(rejulgada.resumo.valor_dos_acertos, Some(600));
        assert!((rejulgada.precisao - 600.0 / 1200.0).abs() < 1e-9);
        assert_eq!(rejulgada.pontos, 150);
    }

    #[test]
    fn sem_a_nota_aberta_o_traste_verde_acerta_a_aberta() {
        let chart = ChartGuardado {
            arquivo: b"[Song]
{
 Resolution = 192
}
[ExpertSingle]
{
192 = N 7 0
384 = N 1 0
}"
            .to_vec(),
            midi: false,
            atraso_ms: 0.0,
        };
        let notas = motor::notas_do_chart(&chart, motor::Instrumento::Guitarra, motor::Dificuldade::Expert).unwrap();
        let toques = |pista_da_aberta| {
            [(notas[0].tempo, pista_da_aberta), (notas[1].tempo, 1)].into_iter().flat_map(|(tempo, pista)| {
                [
                    motor::Entrada {
                        tempo,
                        tipo: motor::TipoDaEntrada::Tocar,
                        pista,
                    },
                    motor::Entrada {
                        tempo: tempo + 0.05,
                        tipo: motor::TipoDaEntrada::Soltar,
                        pista,
                    },
                ]
            })
        };
        let replay = |sem_aberta, pista_da_aberta| {
            motor::empacotar_replay(&motor::Replay {
                sem_falha: false,
                fantasma: false,
                sem_aberta,
                velocidade: 1.0,
                jeito: motor::JeitoDeJogar::Gamepad,
                pune_toque_em_vazio: false,
                // O hash é sempre o do chart original, com a aberta.
                hash_do_chart: motor::hash_do_chart(&notas),
                entradas: toques(pista_da_aberta).collect(),
            })
        };
        let sem_aberta = rejulgar(&chart, Instrumento::Guitarra, Dificuldade::Expert, &replay(true, 0)).unwrap();
        let com_aberta = rejulgar(&chart, Instrumento::Guitarra, Dificuldade::Expert, &replay(false, motor::PISTA_ABERTA)).unwrap();
        assert_eq!((sem_aberta.resumo.acertos, sem_aberta.resumo.total), (2, 2));
        assert_eq!(sem_aberta.pontos, com_aberta.pontos);
    }

    #[test]
    fn rejulga_com_o_jeito_de_jogar_do_replay() {
        let chart = chart();
        let toques = replay(&chart, &[(0, 0.0), (1, 0.0)]);
        let mut na_palhetada = motor::desempacotar_replay(&toques).unwrap();
        na_palhetada.jeito = motor::JeitoDeJogar::Palhetada;
        let rejulgada = rejulgar(&chart, Instrumento::Guitarra, Dificuldade::Expert, &motor::empacotar_replay(&na_palhetada)).unwrap();
        assert_eq!(rejulgada.resumo.acertos, 0);
        assert_eq!(rejulgada.jeito_de_jogar, JeitoDeJogar::Palhetada);
    }

    #[test]
    fn recusa_replay_de_antes_da_versao_4_em_outro_jeito_que_nao_o_gamepad() {
        let chart = chart();
        let mut na_palhetada = motor::desempacotar_replay(&replay(&chart, &[(0, 0.0)])).unwrap();
        na_palhetada.jeito = motor::JeitoDeJogar::Palhetada;
        let mut antigo = motor::empacotar_replay(&na_palhetada);
        antigo[0] = 3;
        assert_eq!(
            rejulgar(&chart, Instrumento::Guitarra, Dificuldade::Expert, &antigo),
            Err(Recusa::JeitoDeOutraVersao)
        );
    }

    #[test]
    fn rejulga_o_toque_em_vazio_so_nos_replays_que_tem_a_regra() {
        let chart = chart();
        let mut lido = motor::desempacotar_replay(&replay(&chart, &[(0, 0.0), (1, 0.0)])).unwrap();
        let primeira = lido.entradas[0];
        // Entre as duas notas, um aperto longe de qualquer nota da pista.
        lido.entradas.insert(
            2,
            motor::Entrada {
                tempo: primeira.tempo + 0.25,
                ..primeira
            },
        );
        let sem_regra = rejulgar(&chart, Instrumento::Guitarra, Dificuldade::Expert, &motor::empacotar_replay(&lido)).unwrap();
        lido.pune_toque_em_vazio = true;
        let com_regra = rejulgar(&chart, Instrumento::Guitarra, Dificuldade::Expert, &motor::empacotar_replay(&lido)).unwrap();
        assert_eq!(sem_regra.resumo.maior_sequencia, Some(2));
        assert_eq!(com_regra.resumo.maior_sequencia, Some(1));
        assert_eq!(com_regra.resumo.acertos, 2);
    }

    #[test]
    fn diz_quando_a_partida_foi_sem_falha() {
        let chart = chart();
        let normal = rejulgar(&chart, Instrumento::Guitarra, Dificuldade::Expert, &replay(&chart, &[(0, 0.0)])).unwrap();
        let sem_falha = rejulgar(&chart, Instrumento::Guitarra, Dificuldade::Expert, &replay_com(&chart, &[(0, 0.0)], true)).unwrap();
        assert!(!normal.sem_falha);
        assert!(sem_falha.sem_falha);
    }

    #[test]
    fn rejulga_na_velocidade_do_replay_e_recusa_velocidade_que_o_jogo_nao_tem() {
        let chart = chart();
        let todas = [(0, 0.0), (1, 0.0), (2, 0.0), (3, 0.0)];
        let normal = rejulgar(&chart, Instrumento::Guitarra, Dificuldade::Expert, &replay(&chart, &todas)).unwrap();
        let lenta = rejulgar(
            &chart,
            Instrumento::Guitarra,
            Dificuldade::Expert,
            &replay_na_velocidade(&chart, &todas, false, 0.5),
        )
        .unwrap();
        let rapida = rejulgar(
            &chart,
            Instrumento::Guitarra,
            Dificuldade::Expert,
            &replay_na_velocidade(&chart, &todas, false, 1.5),
        )
        .unwrap();
        assert_eq!((normal.resumo.acertos, lenta.resumo.acertos, rapida.resumo.acertos), (4, 4, 4));
        assert_eq!((normal.pontos, lenta.pontos, rapida.pontos), (200, 100, 300));
        assert_eq!(
            rejulgar(
                &chart,
                Instrumento::Guitarra,
                Dificuldade::Expert,
                &replay_na_velocidade(&chart, &todas, false, 2.0)
            ),
            Err(Recusa::VelocidadeInvalida)
        );
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
    fn a_janela_tem_40_segundos_e_cabem_40_pedidos() {
        let agora = Utc.with_ymd_and_hms(2026, 1, 1, 0, 1, 0).unwrap();
        assert_eq!(inicio_da_janela(agora), Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 20).unwrap());
        assert!(cabe_mais_um(39));
        assert!(!cabe_mais_um(40));
    }
}
