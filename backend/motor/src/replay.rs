//! Lê o replay que o app grava (`replay.ts`) e reaplica as entradas sobre a partida.

use crate::partida::{ativar_estrela, avancar, palhetar, soltar, tocar, JeitoDeJogar, Partida, PISTA_ABERTA};

const TICKS_POR_SEGUNDO: f64 = 1000.0;
const BYTES_DO_HASH: usize = 16;
const ESTRELA: u64 = 10;
const APERTA_A_ABERTA: u64 = 11;
const SOLTA_A_ABERTA: u64 = 12;
const PALHETA: u64 = 13;
/// Uma música inteira tem poucos milhares de entradas; o teto barra um replay feito para travar o servidor.
const MAXIMO_DE_ENTRADAS: u64 = 200_000;
const MAXIMO_DESCOMPRIMIDO: usize = 4 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TipoDaEntrada {
    Tocar,
    Soltar,
    Estrela,
    /// Só vale na palhetada: toca o acorde dos trastes apertados.
    Palhetar,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Entrada {
    /// Segundos da música, já na grade da partida.
    pub tempo: f64,
    pub tipo: TipoDaEntrada,
    pub pista: u8,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Replay {
    pub sem_falha: bool,
    pub fantasma: bool,
    /// Jogou com a nota aberta desligada. Replays antigos não têm o bit e tocam com ela.
    pub sem_aberta: bool,
    /// Velocidade da música. Os replays de antes da versão 3 são todos a 1x.
    pub velocidade: f64,
    /// Os replays de antes da versão 4 são todos do gamepad.
    pub jeito: JeitoDeJogar,
    /// Só os replays da versão 5 em diante tocam com a punição do toque em vazio.
    pub pune_toque_em_vazio: bool,
    pub hash_do_chart: String,
    pub entradas: Vec<Entrada>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ErroDoReplay {
    VersaoDesconhecida,
    Corrompido,
}

/// Quantos códigos de tecla cada versão tem: a 2 ganhou os da nota aberta.
fn codigos_da_versao(versao: u8) -> Option<u64> {
    match versao {
        1 => Some(11),
        2 | 3 => Some(13),
        4 | 5 => Some(14),
        _ => None,
    }
}

pub fn desempacotar_replay(pacote: &[u8]) -> Result<Replay, ErroDoReplay> {
    let (&versao, comprimido) = pacote.split_first().ok_or(ErroDoReplay::Corrompido)?;
    let codigos = codigos_da_versao(versao).ok_or(ErroDoReplay::VersaoDesconhecida)?;
    let bytes = miniz_oxide::inflate::decompress_to_vec_with_limit(comprimido, MAXIMO_DESCOMPRIMIDO).map_err(|_| ErroDoReplay::Corrompido)?;
    if bytes.is_empty() {
        return Err(ErroDoReplay::Corrompido);
    }
    let opcoes = bytes[0];
    // A versão 3 guarda a velocidade, em centésimos, logo depois das opções.
    let (velocidade, inicio_do_hash) = if versao >= 3 { (f64::from(bytes[1]) / 100.0, 2) } else { (1.0, 1) };
    if bytes.len() < inicio_do_hash + BYTES_DO_HASH {
        return Err(ErroDoReplay::Corrompido);
    }
    let hash_do_chart = bytes[inicio_do_hash..inicio_do_hash + BYTES_DO_HASH]
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    let mut leitor = Leitor {
        bytes: &bytes,
        posicao: inicio_do_hash + BYTES_DO_HASH,
    };
    let primeiro = leitor.varint()?;
    let mut ticks = if primeiro % 2 == 1 {
        -i64::try_from(primeiro.div_ceil(2)).map_err(|_| ErroDoReplay::Corrompido)?
    } else {
        i64::try_from(primeiro / 2).map_err(|_| ErroDoReplay::Corrompido)?
    };
    let quantas = leitor.varint()?;
    if quantas > MAXIMO_DE_ENTRADAS {
        return Err(ErroDoReplay::Corrompido);
    }
    let mut entradas = Vec::new();
    for _ in 0..quantas {
        let valor = leitor.varint()?;
        let codigo = valor % codigos;
        let passo = i64::try_from(valor / codigos).map_err(|_| ErroDoReplay::Corrompido)?;
        ticks = ticks.checked_add(passo).ok_or(ErroDoReplay::Corrompido)?;
        entradas.push(entrada_do_codigo(ticks, codigo));
    }
    Ok(Replay {
        sem_falha: opcoes & 1 != 0,
        fantasma: opcoes & 2 != 0,
        sem_aberta: opcoes & 4 != 0,
        velocidade,
        pune_toque_em_vazio: versao >= 5,
        jeito: match (opcoes >> 3) & 3 {
            0 => JeitoDeJogar::Gamepad,
            1 => JeitoDeJogar::Tapping,
            2 => JeitoDeJogar::Palhetada,
            _ => return Err(ErroDoReplay::Corrompido),
        },
        hash_do_chart,
        entradas,
    })
}

/// O inverso de `desempacotar_replay`, no formato da versão atual (a 4 sem a punição do toque em vazio, a 5 com). A API não grava replays; serve aos testes dela.
pub fn empacotar_replay(replay: &Replay) -> Vec<u8> {
    const CODIGOS: i64 = 14;
    // A velocidade vai em centésimos: 0,75x é 75.
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let velocidade = (replay.velocidade * 100.0).round().clamp(0.0, 255.0) as u8;
    let mut bytes = vec![
        u8::from(replay.sem_falha) | (u8::from(replay.fantasma) << 1) | (u8::from(replay.sem_aberta) << 2) | (bits_do_jeito(replay.jeito) << 3),
        velocidade,
    ];
    bytes.extend((0..BYTES_DO_HASH).map(|i| u8::from_str_radix(replay.hash_do_chart.get(i * 2..i * 2 + 2).unwrap_or("00"), 16).unwrap_or(0)));
    let em_ticks = |tempo: f64| {
        // Tempos de música: cabem com folga num i64.
        #[allow(clippy::cast_possible_truncation)]
        let ticks = (tempo * TICKS_POR_SEGUNDO + 0.5).floor() as i64;
        ticks
    };
    let mut anterior = replay.entradas.first().map_or(0, |e| em_ticks(e.tempo));
    escrever_varint(
        &mut bytes,
        if anterior < 0 {
            (-anterior * 2 - 1).unsigned_abs()
        } else {
            (anterior * 2).unsigned_abs()
        },
    );
    escrever_varint(&mut bytes, replay.entradas.len() as u64);
    for entrada in &replay.entradas {
        let ticks = em_ticks(entrada.tempo);
        let codigo = match (entrada.tipo, entrada.pista) {
            (TipoDaEntrada::Estrela, _) => 10,
            (TipoDaEntrada::Palhetar, _) => 13,
            (TipoDaEntrada::Tocar, PISTA_ABERTA) => 11,
            (TipoDaEntrada::Soltar, PISTA_ABERTA) => 12,
            (TipoDaEntrada::Tocar, pista) => i64::from(pista),
            (TipoDaEntrada::Soltar, pista) => 5 + i64::from(pista),
        };
        escrever_varint(&mut bytes, ((ticks - anterior) * CODIGOS + codigo).unsigned_abs());
        anterior = ticks;
    }
    let mut pacote = vec![if replay.pune_toque_em_vazio { 5 } else { 4 }];
    pacote.extend(miniz_oxide::deflate::compress_to_vec(&bytes, 6));
    pacote
}

fn bits_do_jeito(jeito: JeitoDeJogar) -> u8 {
    match jeito {
        JeitoDeJogar::Gamepad => 0,
        JeitoDeJogar::Tapping => 1,
        JeitoDeJogar::Palhetada => 2,
    }
}

fn escrever_varint(bytes: &mut Vec<u8>, mut valor: u64) {
    while valor >= 128 {
        bytes.push((valor % 128) as u8 | 128);
        valor /= 128;
    }
    bytes.push(valor as u8);
}

/// 0 a 4 aperta a pista, 5 a 9 solta, 10 ativa o star power, 11 aperta e 12 solta a nota aberta, 13 palheta.
fn entrada_do_codigo(ticks: i64, codigo: u64) -> Entrada {
    // Os ticks de uma música cabem com folga nos 53 bits exatos do f64.
    #[allow(clippy::cast_precision_loss)]
    let tempo = ticks as f64 / TICKS_POR_SEGUNDO;
    let (tipo, pista) = match codigo {
        ESTRELA => (TipoDaEntrada::Estrela, 0),
        APERTA_A_ABERTA => (TipoDaEntrada::Tocar, PISTA_ABERTA),
        SOLTA_A_ABERTA => (TipoDaEntrada::Soltar, PISTA_ABERTA),
        PALHETA => (TipoDaEntrada::Palhetar, 0),
        0..=4 => (TipoDaEntrada::Tocar, codigo as u8),
        _ => (TipoDaEntrada::Soltar, (codigo % 5) as u8),
    };
    Entrada { tempo, tipo, pista }
}

struct Leitor<'a> {
    bytes: &'a [u8],
    posicao: usize,
}

impl Leitor<'_> {
    fn varint(&mut self) -> Result<u64, ErroDoReplay> {
        let mut valor: u64 = 0;
        let mut escala: u64 = 1;
        loop {
            let &byte = self.bytes.get(self.posicao).ok_or(ErroDoReplay::Corrompido)?;
            self.posicao += 1;
            let parte = u64::from(byte & 127).checked_mul(escala).ok_or(ErroDoReplay::Corrompido)?;
            valor = valor.checked_add(parte).ok_or(ErroDoReplay::Corrompido)?;
            if byte < 128 {
                return Ok(valor);
            }
            escala = escala.checked_mul(128).ok_or(ErroDoReplay::Corrompido)?;
        }
    }
}

/// Aplica todas as entradas, na ordem, como o app faz ao assistir um replay.
pub fn aplicar_entradas(partida: &mut Partida, entradas: &[Entrada]) {
    for entrada in entradas {
        match entrada.tipo {
            TipoDaEntrada::Tocar => {
                tocar(partida, entrada.pista, entrada.tempo);
            }
            TipoDaEntrada::Soltar => soltar(partida, entrada.pista, entrada.tempo),
            TipoDaEntrada::Palhetar => {
                palhetar(partida, entrada.tempo);
            }
            TipoDaEntrada::Estrela => {
                avancar(partida, entrada.tempo);
                ativar_estrela(partida);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recusa_versao_desconhecida_e_pacote_vazio() {
        assert_eq!(desempacotar_replay(&[42, 0]), Err(ErroDoReplay::VersaoDesconhecida));
        assert_eq!(desempacotar_replay(&[]), Err(ErroDoReplay::Corrompido));
        assert_eq!(desempacotar_replay(&[2, 1, 2, 3]), Err(ErroDoReplay::Corrompido));
    }

    #[test]
    fn o_replay_empacotado_volta_igual() {
        let replay = Replay {
            sem_falha: true,
            fantasma: false,
            sem_aberta: false,
            velocidade: 0.75,
            jeito: JeitoDeJogar::Palhetada,
            pune_toque_em_vazio: true,
            hash_do_chart: "00112233445566778899aabbccddeeff".into(),
            entradas: vec![
                Entrada {
                    tempo: 1.25,
                    tipo: TipoDaEntrada::Tocar,
                    pista: 2,
                },
                Entrada {
                    tempo: 1.5,
                    tipo: TipoDaEntrada::Soltar,
                    pista: PISTA_ABERTA,
                },
                Entrada {
                    tempo: 1.75,
                    tipo: TipoDaEntrada::Palhetar,
                    pista: 0,
                },
                Entrada {
                    tempo: 2.0,
                    tipo: TipoDaEntrada::Estrela,
                    pista: 0,
                },
            ],
        };
        assert_eq!(desempacotar_replay(&empacotar_replay(&replay)), Ok(replay));
    }

    #[test]
    fn guarda_quem_jogou_sem_a_nota_aberta() {
        let replay = Replay {
            sem_falha: false,
            fantasma: true,
            sem_aberta: true,
            velocidade: 1.0,
            jeito: JeitoDeJogar::Gamepad,
            pune_toque_em_vazio: false,
            hash_do_chart: "00112233445566778899aabbccddeeff".into(),
            entradas: vec![],
        };
        let lido = desempacotar_replay(&empacotar_replay(&replay)).unwrap();
        assert!(lido.sem_aberta);
        assert!(lido.fantasma);
        assert!(!lido.sem_falha);
    }

    #[test]
    fn le_os_codigos_das_teclas() {
        assert_eq!(entrada_do_codigo(1500, 3).tipo, TipoDaEntrada::Tocar);
        assert_eq!(entrada_do_codigo(1500, 8).pista, 3);
        assert_eq!(entrada_do_codigo(1500, 12).pista, PISTA_ABERTA);
        assert_eq!(entrada_do_codigo(1500, 10).tempo, 1.5);
        assert_eq!(entrada_do_codigo(1500, 13).tipo, TipoDaEntrada::Palhetar);
    }

    #[test]
    fn o_replay_da_versao_3_e_do_gamepad() {
        let mut pacote = vec![3];
        let mut bytes = vec![0, 100];
        bytes.extend([0; BYTES_DO_HASH]);
        bytes.extend([0, 0]);
        pacote.extend(miniz_oxide::deflate::compress_to_vec(&bytes, 6));
        let lido = desempacotar_replay(&pacote).unwrap();
        assert_eq!(lido.jeito, JeitoDeJogar::Gamepad);
        assert!(!lido.pune_toque_em_vazio);
    }

    #[test]
    fn recusa_jeito_desconhecido() {
        let mut pacote = vec![4];
        let mut bytes = vec![3 << 3, 100];
        bytes.extend([0; BYTES_DO_HASH]);
        bytes.extend([0, 0]);
        pacote.extend(miniz_oxide::deflate::compress_to_vec(&bytes, 6));
        assert_eq!(desempacotar_replay(&pacote), Err(ErroDoReplay::Corrompido));
    }
}
