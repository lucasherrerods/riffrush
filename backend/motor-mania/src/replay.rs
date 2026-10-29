//! O replay do Mania: os mods, a semente, o md5 do `.osu` e cada toque e soltura em ms, comprimidos.
//! O app grava e a API reproduz com as mesmas regras, então o resultado da partida sai só daqui.
//!
//! Formato (versão 1): o primeiro byte é a versão, fora da compressão, para a API conferir sem descomprimir.
//! O resto é deflate cru de: mods (u32 LE), semente (u32 LE), md5 (16 bytes), número de entradas (varint) e,
//! por entrada, o intervalo para a anterior (varint com zigzag, porque a primeira pode vir antes do zero) e um
//! byte com `coluna << 1 | toca`.

use crate::beatmap::Beatmap;
use crate::mods::Mods;
use crate::partida::{avancar, criar_partida, soltar, tocar, OpcoesDaPartida, Partida};

pub const VERSAO_DO_REPLAY: u8 = 1;
const BYTES_DO_HASH: usize = 16;
/// Um mapa de 10 minutos bem denso não passa de uns 30 mil toques e solturas.
pub const MAXIMO_DE_ENTRADAS: usize = 200_000;
const MAXIMO_DESCOMPRIMIDO: usize = 8 + BYTES_DO_HASH + 5 + MAXIMO_DE_ENTRADAS * 6;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Entrada {
    pub tempo_ms: i32,
    pub coluna: u8,
    /// `true` ao apertar, `false` ao soltar.
    pub toca: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Replay {
    pub mods: Mods,
    pub semente: u32,
    /// md5 do `.osu`, em hex.
    pub hash: String,
    pub entradas: Vec<Entrada>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErroDoReplay {
    VersaoDesconhecida,
    Corrompido,
    /// As entradas têm de vir em ordem de tempo.
    ForaDeOrdem,
    GrandeDemais,
}

fn escrever_varint(bytes: &mut Vec<u8>, mut valor: u64) {
    while valor >= 0x80 {
        bytes.push((valor as u8) | 0x80);
        valor >>= 7;
    }
    bytes.push(valor as u8);
}

const fn zigzag(valor: i64) -> u64 {
    ((valor << 1) ^ (valor >> 63)) as u64
}

const fn de_zigzag(valor: u64) -> i64 {
    ((valor >> 1) as i64) ^ -((valor & 1) as i64)
}

pub fn empacotar_replay(replay: &Replay) -> Vec<u8> {
    let mut corpo = Vec::with_capacity(32 + replay.entradas.len() * 3);
    corpo.extend(replay.mods.0.to_le_bytes());
    corpo.extend(replay.semente.to_le_bytes());
    corpo.extend((0..BYTES_DO_HASH).map(|i| replay.hash.get(i * 2..i * 2 + 2).and_then(|h| u8::from_str_radix(h, 16).ok()).unwrap_or(0)));
    escrever_varint(&mut corpo, replay.entradas.len() as u64);
    let mut anterior = 0_i64;
    for entrada in &replay.entradas {
        escrever_varint(&mut corpo, zigzag(i64::from(entrada.tempo_ms) - anterior));
        anterior = i64::from(entrada.tempo_ms);
        corpo.push((entrada.coluna << 1) | u8::from(entrada.toca));
    }
    let mut pacote = vec![VERSAO_DO_REPLAY];
    pacote.extend(miniz_oxide::deflate::compress_to_vec(&corpo, 6));
    pacote
}

struct Leitor<'a> {
    bytes: &'a [u8],
    posicao: usize,
}

impl Leitor<'_> {
    fn bytes(&mut self, quantos: usize) -> Result<&[u8], ErroDoReplay> {
        let fim = self
            .posicao
            .checked_add(quantos)
            .filter(|&f| f <= self.bytes.len())
            .ok_or(ErroDoReplay::Corrompido)?;
        let lidos = &self.bytes[self.posicao..fim];
        self.posicao = fim;
        Ok(lidos)
    }

    fn u32(&mut self) -> Result<u32, ErroDoReplay> {
        let b = self.bytes(4)?;
        Ok(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    }

    fn varint(&mut self) -> Result<u64, ErroDoReplay> {
        let mut valor = 0_u64;
        for deslocamento in (0..64).step_by(7) {
            let byte = self.bytes(1)?[0];
            valor |= u64::from(byte & 0x7f) << deslocamento;
            if byte & 0x80 == 0 {
                return Ok(valor);
            }
        }
        Err(ErroDoReplay::Corrompido)
    }
}

pub fn desempacotar_replay(pacote: &[u8]) -> Result<Replay, ErroDoReplay> {
    let (&versao, comprimido) = pacote.split_first().ok_or(ErroDoReplay::Corrompido)?;
    if versao != VERSAO_DO_REPLAY {
        return Err(ErroDoReplay::VersaoDesconhecida);
    }
    let corpo = miniz_oxide::inflate::decompress_to_vec_with_limit(comprimido, MAXIMO_DESCOMPRIMIDO).map_err(|_| ErroDoReplay::GrandeDemais)?;
    let mut leitor = Leitor { bytes: &corpo, posicao: 0 };
    let mods = Mods(leitor.u32()?);
    let semente = leitor.u32()?;
    let hash = leitor.bytes(BYTES_DO_HASH)?.iter().map(|b| format!("{b:02x}")).collect();
    let quantas = usize::try_from(leitor.varint()?).map_err(|_| ErroDoReplay::GrandeDemais)?;
    if quantas > MAXIMO_DE_ENTRADAS {
        return Err(ErroDoReplay::GrandeDemais);
    }
    let mut entradas = Vec::with_capacity(quantas);
    let mut tempo = 0_i64;
    for i in 0..quantas {
        let intervalo = de_zigzag(leitor.varint()?);
        if i > 0 && intervalo < 0 {
            return Err(ErroDoReplay::ForaDeOrdem);
        }
        tempo += intervalo;
        let codigo = leitor.bytes(1)?[0];
        entradas.push(Entrada {
            tempo_ms: i32::try_from(tempo).map_err(|_| ErroDoReplay::Corrompido)?,
            coluna: codigo >> 1,
            toca: codigo & 1 == 1,
        });
    }
    if leitor.posicao != corpo.len() {
        return Err(ErroDoReplay::Corrompido);
    }
    Ok(Replay { mods, semente, hash, entradas })
}

/// Toca o replay sobre o mapa até a última nota passar, como o app ao assistir. É o que a API usa para rejulgar.
pub fn jogar_replay(beatmap: &Beatmap, replay: &Replay) -> Partida {
    let mut partida = criar_partida(
        beatmap,
        OpcoesDaPartida {
            mods: replay.mods,
            semente: replay.semente,
        },
    );
    for entrada in &replay.entradas {
        if entrada.toca {
            tocar(&mut partida, entrada.coluna, entrada.tempo_ms);
        } else {
            soltar(&mut partida, entrada.coluna, entrada.tempo_ms);
        }
    }
    let fim = partida.notas.iter().map(|n| n.fim_ms.unwrap_or(n.tempo_ms)).max().unwrap_or(0);
    avancar(&mut partida, fim.saturating_add(10_000));
    partida
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::beatmap::ler_beatmap;
    use crate::partida::pontuacao;

    fn replay() -> Replay {
        Replay {
            mods: Mods::HR.com(Mods::MIRROR),
            semente: 0xdead_beef,
            hash: "00112233445566778899aabbccddeeff".into(),
            entradas: vec![
                Entrada {
                    tempo_ms: -300,
                    coluna: 2,
                    toca: true,
                },
                Entrada {
                    tempo_ms: -250,
                    coluna: 2,
                    toca: false,
                },
                Entrada {
                    tempo_ms: 1000,
                    coluna: 0,
                    toca: true,
                },
                Entrada {
                    tempo_ms: 1000,
                    coluna: 17,
                    toca: true,
                },
                Entrada {
                    tempo_ms: 600_000,
                    coluna: 0,
                    toca: false,
                },
            ],
        }
    }

    #[test]
    fn ida_e_volta_devolve_o_mesmo_replay() {
        assert_eq!(desempacotar_replay(&empacotar_replay(&replay())), Ok(replay()));
    }

    #[test]
    fn o_primeiro_byte_e_a_versao() {
        assert_eq!(empacotar_replay(&replay())[0], VERSAO_DO_REPLAY);
        let mut outro = empacotar_replay(&replay());
        outro[0] = 9;
        assert_eq!(desempacotar_replay(&outro), Err(ErroDoReplay::VersaoDesconhecida));
    }

    #[test]
    fn recusa_pacote_quebrado_e_fora_de_ordem() {
        assert_eq!(desempacotar_replay(&[]), Err(ErroDoReplay::Corrompido));
        assert!(desempacotar_replay(&[1, 2, 3]).is_err());
        let mut fora = replay();
        fora.entradas.swap(2, 4);
        assert_eq!(desempacotar_replay(&empacotar_replay(&fora)), Err(ErroDoReplay::ForaDeOrdem));
    }

    #[test]
    fn um_mapa_denso_inteiro_fica_com_poucos_kb() {
        let entradas = (0..6000)
            .map(|i| Entrada {
                tempo_ms: 1000 + i * 60 + (i * 37 % 11),
                coluna: (i % 7) as u8,
                toca: i % 2 == 0,
            })
            .collect();
        assert!(empacotar_replay(&Replay { entradas, ..replay() }).len() < 16 * 1024);
    }

    #[test]
    fn jogar_o_replay_reproduz_a_partida() {
        let mapa = ler_beatmap(
            "osu file format v14\n[General]\nMode: 3\n[Difficulty]\nCircleSize:4\nOverallDifficulty:5\n[HitObjects]\n64,192,1000,1,0\n192,192,1500,128,0,2000:0:0:0:0:\n",
        )
        .unwrap();
        let replay = Replay {
            mods: Mods::NENHUM,
            semente: 0,
            hash: String::new(),
            entradas: vec![
                Entrada {
                    tempo_ms: 1000,
                    coluna: 0,
                    toca: true,
                },
                Entrada {
                    tempo_ms: 1050,
                    coluna: 0,
                    toca: false,
                },
                Entrada {
                    tempo_ms: 1500,
                    coluna: 1,
                    toca: true,
                },
                Entrada {
                    tempo_ms: 2000,
                    coluna: 1,
                    toca: false,
                },
            ],
        };
        let partida = jogar_replay(&mapa, &replay);
        assert_eq!(partida.contagem[0], 3);
        assert_eq!(pontuacao(&partida), 1_000_000);
        // Sem entrada nenhuma, tudo vira Miss até o fim.
        let vazio = jogar_replay(&mapa, &Replay { entradas: vec![], ..replay });
        assert_eq!(vazio.contagem[5], 3);
    }
}
