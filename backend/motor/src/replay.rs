//! Lê o replay que o app grava (`replay.ts`) e reaplica as entradas sobre a partida.

use crate::partida::{ativar_estrela, avancar, soltar, tocar, Partida, PISTA_ABERTA};

const TICKS_POR_SEGUNDO: f64 = 1000.0;
const BYTES_DO_HASH: usize = 16;
const ESTRELA: u64 = 10;
const APERTA_A_ABERTA: u64 = 11;
const SOLTA_A_ABERTA: u64 = 12;
/// Uma música inteira tem poucos milhares de entradas; o teto barra um replay feito para travar o servidor.
const MAXIMO_DE_ENTRADAS: u64 = 200_000;
const MAXIMO_DESCOMPRIMIDO: usize = 4 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TipoDaEntrada {
    Tocar,
    Soltar,
    Estrela,
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
        2 => Some(13),
        _ => None,
    }
}

pub fn desempacotar_replay(pacote: &[u8]) -> Result<Replay, ErroDoReplay> {
    let (&versao, comprimido) = pacote.split_first().ok_or(ErroDoReplay::Corrompido)?;
    let codigos = codigos_da_versao(versao).ok_or(ErroDoReplay::VersaoDesconhecida)?;
    let bytes = miniz_oxide::inflate::decompress_to_vec_with_limit(comprimido, MAXIMO_DESCOMPRIMIDO).map_err(|_| ErroDoReplay::Corrompido)?;
    if bytes.len() < 1 + BYTES_DO_HASH {
        return Err(ErroDoReplay::Corrompido);
    }
    let opcoes = bytes[0];
    let hash_do_chart = bytes[1..=BYTES_DO_HASH].iter().map(|b| format!("{b:02x}")).collect();
    let mut leitor = Leitor {
        bytes: &bytes,
        posicao: 1 + BYTES_DO_HASH,
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
        hash_do_chart,
        entradas,
    })
}

/// 0 a 4 aperta a pista, 5 a 9 solta, 10 ativa o star power, 11 aperta e 12 solta a nota aberta.
fn entrada_do_codigo(ticks: i64, codigo: u64) -> Entrada {
    // Os ticks de uma música cabem com folga nos 53 bits exatos do f64.
    #[allow(clippy::cast_precision_loss)]
    let tempo = ticks as f64 / TICKS_POR_SEGUNDO;
    let (tipo, pista) = match codigo {
        ESTRELA => (TipoDaEntrada::Estrela, 0),
        APERTA_A_ABERTA => (TipoDaEntrada::Tocar, PISTA_ABERTA),
        SOLTA_A_ABERTA => (TipoDaEntrada::Soltar, PISTA_ABERTA),
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
    fn le_os_codigos_das_teclas() {
        assert_eq!(entrada_do_codigo(1500, 3).tipo, TipoDaEntrada::Tocar);
        assert_eq!(entrada_do_codigo(1500, 8).pista, 3);
        assert_eq!(entrada_do_codigo(1500, 12).pista, PISTA_ABERTA);
        assert_eq!(entrada_do_codigo(1500, 10).tempo, 1.5);
    }
}
