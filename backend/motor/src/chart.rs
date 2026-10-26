//! Lê o .sng do Clone Hero e tira as notas de cada trilha, como `songs/cloneHero.ts` do app.
//! O tipo da nota (HOPO, tap) muda só o visual, então fica de fora: aqui importam tempo, pista, frase e sustain.

use std::collections::{BTreeMap, HashMap};

use regex::Regex;
use sha2::{Digest, Sha256};

use crate::partida::{quantizar, Nota, PISTA_ABERTA};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Instrumento {
    Guitarra,
    Baixo,
    Ritmica,
    Coop,
    Teclado,
}

/// Na ordem do app: sem o instrumento pedido, vale o primeiro que o chart tem.
const INSTRUMENTOS: [Instrumento; 5] = [
    Instrumento::Guitarra,
    Instrumento::Baixo,
    Instrumento::Ritmica,
    Instrumento::Coop,
    Instrumento::Teclado,
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Dificuldade {
    Facil,
    Medio,
    Dificil,
    Expert,
}

const DIFICULDADES: [Dificuldade; 4] = [Dificuldade::Facil, Dificuldade::Medio, Dificuldade::Dificil, Dificuldade::Expert];

#[derive(Debug, PartialEq, Eq)]
pub enum ErroDoChart {
    SngInvalido,
    SemChart,
    MidiInvalido,
}

pub struct PacoteSng {
    pub metadados: HashMap<String, String>,
    pub arquivos: HashMap<String, Vec<u8>>,
}

/// O começo do .sng: máscara, metadados e onde cada arquivo está. O conteúdo vem depois.
struct Cabecalho {
    mascara: [u8; 16],
    metadados: HashMap<String, String>,
    /// Nome (em minúsculas), posição no pacote e tamanho.
    arquivos: Vec<(String, usize, usize)>,
}

/// Lê "SNGPKG", versão, máscara, metadados e índice. Devolve None enquanto `bytes` ainda não tem o cabeçalho inteiro.
fn ler_cabecalho(bytes: &[u8]) -> Result<Option<Cabecalho>, ErroDoChart> {
    if bytes.len() >= 6 && &bytes[..6] != b"SNGPKG" {
        return Err(ErroDoChart::SngInvalido);
    }
    // Cada seção começa pelo próprio tamanho: dá para saber se ela já chegou antes de ler.
    let tamanho_em = |posicao: usize| -> Result<Option<usize>, ErroDoChart> {
        match bytes.get(posicao..posicao + 8) {
            None => Ok(None),
            Some(b) => {
                let tamanho = u64::from_le_bytes(b.try_into().map_err(|_| ErroDoChart::SngInvalido)?);
                usize::try_from(tamanho).map(Some).map_err(|_| ErroDoChart::SngInvalido)
            }
        }
    };
    let Some(tamanho_dos_metadados) = tamanho_em(26)? else {
        return Ok(None);
    };
    let inicio_do_indice = 34usize.checked_add(tamanho_dos_metadados).ok_or(ErroDoChart::SngInvalido)?;
    let Some(tamanho_do_indice) = tamanho_em(inicio_do_indice)? else {
        return Ok(None);
    };
    let fim_do_indice = (inicio_do_indice + 8).checked_add(tamanho_do_indice).ok_or(ErroDoChart::SngInvalido)?;
    if bytes.len() < fim_do_indice {
        return Ok(None);
    }

    let mascara: [u8; 16] = bytes[10..26].try_into().map_err(|_| ErroDoChart::SngInvalido)?;
    let mut leitor = Leitor { bytes, posicao: 34 };
    let mut metadados = HashMap::new();
    for _ in 0..leitor.u64()? {
        let tamanho = leitor.i32()?;
        let chave = leitor.texto(tamanho)?;
        let tamanho = leitor.i32()?;
        metadados.insert(chave.to_lowercase(), leitor.texto(tamanho)?);
    }
    leitor.posicao = inicio_do_indice + 8;
    let mut arquivos = Vec::new();
    for _ in 0..leitor.u64()? {
        let tamanho = leitor.u8()?;
        let nome = leitor.texto(tamanho.into())?.to_lowercase();
        let tamanho = usize::try_from(leitor.u64()?).map_err(|_| ErroDoChart::SngInvalido)?;
        let inicio = usize::try_from(leitor.u64()?).map_err(|_| ErroDoChart::SngInvalido)?;
        arquivos.push((nome, inicio, tamanho));
    }
    Ok(Some(Cabecalho { mascara, metadados, arquivos }))
}

/// Tira a máscara XOR de um pedaço de um arquivo do pacote. `posicao` é a do primeiro byte do pedaço dentro do arquivo.
fn desmascarar(mascara: [u8; 16], pedaco: &[u8], posicao: usize) -> Vec<u8> {
    pedaco
        .iter()
        .enumerate()
        .map(|(i, b)| {
            let j = posicao + i;
            b ^ mascara[j & 15] ^ (j & 0xff) as u8
        })
        .collect()
}

/// Lê o pacote inteiro, já na memória.
pub fn ler_sng(bytes: &[u8]) -> Result<PacoteSng, ErroDoChart> {
    let cabecalho = ler_cabecalho(bytes)?.ok_or(ErroDoChart::SngInvalido)?;
    let mut arquivos = HashMap::new();
    for (nome, inicio, tamanho) in cabecalho.arquivos {
        let fim = inicio.checked_add(tamanho).filter(|&f| f <= bytes.len()).ok_or(ErroDoChart::SngInvalido)?;
        arquivos.insert(nome, desmascarar(cabecalho.mascara, &bytes[inicio..fim], 0));
    }
    Ok(PacoteSng {
        metadados: cabecalho.metadados,
        arquivos,
    })
}

/// O cabeçalho e o índice de um .sng cabem com folga nisto; mais que isso é arquivo estranho.
const TAMANHO_MAXIMO_DO_CABECALHO: usize = 1024 * 1024;
/// O maior chart de verdade tem poucas centenas de KB.
const TAMANHO_MAXIMO_DO_CHART: usize = 16 * 1024 * 1024;

/// Tira o chart de um .sng que chega aos poucos (um download), guardando só o cabeçalho e o chart.
/// O áudio, que é quase todo o arquivo, passa sem ficar na memória, e o download pode parar assim que o chart chega.
#[derive(Default)]
pub struct ExtratorDeChart {
    /// Quantos bytes do pacote já passaram.
    recebidos: usize,
    /// O começo do pacote, guardado até dar para ler o cabeçalho.
    comeco: Vec<u8>,
    alvo: Option<Alvo>,
}

struct Alvo {
    mascara: [u8; 16],
    inicio: usize,
    tamanho: usize,
    midi: bool,
    atraso_ms: f64,
    arquivo: Vec<u8>,
}

impl ExtratorDeChart {
    pub fn novo() -> Self {
        Self::default()
    }

    /// Recebe o próximo pedaço do pacote. Devolve o chart assim que ele chega inteiro.
    pub fn receber(&mut self, pedaco: &[u8]) -> Result<Option<ChartGuardado>, ErroDoChart> {
        let inicio_do_pedaco = self.recebidos;
        self.recebidos += pedaco.len();
        if self.alvo.is_some() {
            return Ok(self.coletar(pedaco, inicio_do_pedaco));
        }
        self.comeco.extend_from_slice(pedaco);
        let Some(cabecalho) = ler_cabecalho(&self.comeco)? else {
            if self.comeco.len() > TAMANHO_MAXIMO_DO_CABECALHO {
                return Err(ErroDoChart::SngInvalido);
            }
            return Ok(None);
        };
        self.alvo = Some(alvo_do_cabecalho(cabecalho)?);
        // O começo guardado pode já ter parte do chart, ou ele inteiro.
        let comeco = std::mem::take(&mut self.comeco);
        Ok(self.coletar(&comeco, 0))
    }

    fn coletar(&mut self, pedaco: &[u8], inicio_do_pedaco: usize) -> Option<ChartGuardado> {
        let alvo = self.alvo.as_mut()?;
        let de = alvo.inicio.max(inicio_do_pedaco);
        let ate = (alvo.inicio + alvo.tamanho).min(inicio_do_pedaco + pedaco.len());
        if de < ate {
            let trecho = &pedaco[de - inicio_do_pedaco..ate - inicio_do_pedaco];
            alvo.arquivo.extend(desmascarar(alvo.mascara, trecho, de - alvo.inicio));
        }
        (alvo.arquivo.len() >= alvo.tamanho).then(|| ChartGuardado {
            arquivo: std::mem::take(&mut alvo.arquivo),
            midi: alvo.midi,
            atraso_ms: alvo.atraso_ms,
        })
    }
}

/// O app prefere o .chart quando o pacote tem os dois.
fn alvo_do_cabecalho(cabecalho: Cabecalho) -> Result<Alvo, ErroDoChart> {
    let achar = |nome: &str| {
        cabecalho
            .arquivos
            .iter()
            .find(|(n, _, _)| n == nome)
            .map(|&(_, inicio, tamanho)| (inicio, tamanho))
    };
    let ((inicio, tamanho), midi) = match (achar("notes.chart"), achar("notes.mid")) {
        (Some(chart), _) => (chart, false),
        (None, Some(midi)) => (midi, true),
        (None, None) => return Err(ErroDoChart::SemChart),
    };
    if tamanho > TAMANHO_MAXIMO_DO_CHART || inicio.checked_add(tamanho).is_none() {
        return Err(ErroDoChart::SngInvalido);
    }
    Ok(Alvo {
        mascara: cabecalho.mascara,
        inicio,
        tamanho,
        midi,
        atraso_ms: cabecalho.metadados.get("delay").map_or(0.0, |d| numero_ou(d, 0.0)),
        arquivo: Vec::with_capacity(tamanho),
    })
}

struct Leitor<'a> {
    bytes: &'a [u8],
    posicao: usize,
}

impl Leitor<'_> {
    fn pegar(&mut self, tamanho: usize) -> Result<&[u8], ErroDoChart> {
        let fim = self
            .posicao
            .checked_add(tamanho)
            .filter(|&f| f <= self.bytes.len())
            .ok_or(ErroDoChart::SngInvalido)?;
        let pedaco = &self.bytes[self.posicao..fim];
        self.posicao = fim;
        Ok(pedaco)
    }
    fn u8(&mut self) -> Result<u8, ErroDoChart> {
        Ok(self.pegar(1)?[0])
    }
    fn u64(&mut self) -> Result<u64, ErroDoChart> {
        Ok(u64::from_le_bytes(self.pegar(8)?.try_into().map_err(|_| ErroDoChart::SngInvalido)?))
    }
    fn i32(&mut self) -> Result<usize, ErroDoChart> {
        let valor = i32::from_le_bytes(self.pegar(4)?.try_into().map_err(|_| ErroDoChart::SngInvalido)?);
        usize::try_from(valor).map_err(|_| ErroDoChart::SngInvalido)
    }
    fn texto(&mut self, tamanho: usize) -> Result<String, ErroDoChart> {
        Ok(String::from_utf8_lossy(self.pegar(tamanho)?).into_owned())
    }
}

const ANDAMENTO_PADRAO: f64 = 500_000.0;

struct PontoDeTempo {
    tick: f64,
    segundo: f64,
    segundos_por_tick: f64,
}

/// Converte as posições do chart (ticks) em segundos, seguindo as mudanças de andamento.
pub struct MapaDeTempo {
    pontos: Vec<PontoDeTempo>,
}

impl MapaDeTempo {
    /// `andamentos` em (tick, microssegundos por semínima).
    pub fn new(resolucao: f64, andamentos: &[(f64, f64)]) -> Self {
        let mut ordenados = andamentos.to_vec();
        ordenados.sort_by(|a, b| a.0.total_cmp(&b.0));
        if ordenados.first().is_none_or(|a| a.0 > 0.0) {
            ordenados.insert(0, (0.0, ANDAMENTO_PADRAO));
        }
        let mut pontos: Vec<PontoDeTempo> = Vec::with_capacity(ordenados.len());
        let mut segundo = 0.0;
        for (i, &(tick, microssegundos)) in ordenados.iter().enumerate() {
            if i > 0 {
                segundo += (tick - ordenados[i - 1].0) * pontos[i - 1].segundos_por_tick;
            }
            pontos.push(PontoDeTempo {
                tick,
                segundo,
                segundos_por_tick: microssegundos / 1e6 / resolucao,
            });
        }
        Self { pontos }
    }

    pub fn em_segundos(&self, tick: f64) -> f64 {
        let (mut baixo, mut alto) = (0, self.pontos.len() - 1);
        while baixo < alto {
            let meio = (baixo + alto).div_ceil(2);
            if self.pontos[meio].tick <= tick {
                baixo = meio;
            } else {
                alto = meio - 1;
            }
        }
        let ponto = &self.pontos[baixo];
        ponto.segundo + (tick - ponto.tick) * ponto.segundos_por_tick
    }
}

#[derive(Debug, Clone, Copy)]
struct NotaEmTicks {
    tick: f64,
    pista: u8,
    duracao: f64,
}

#[derive(Debug, Clone, Copy)]
struct Trecho {
    tick: f64,
    duracao: f64,
}

type Trilhas = BTreeMap<(usize, Dificuldade), Vec<Nota>>;

pub struct ChartLido {
    /// Chave: índice do instrumento em `INSTRUMENTOS` e a dificuldade.
    trilhas: Trilhas,
}

/// Uma nota aberta junto com trastes não existe no Clone Hero: fica só o traste.
fn tirar_abertas_dos_acordes(brutas: &[NotaEmTicks]) -> Vec<NotaEmTicks> {
    let mut por_tick: BTreeMap<i64, Vec<NotaEmTicks>> = BTreeMap::new();
    for nota in brutas {
        // Ticks vêm de inteiros; a chave inteira dá a mesma ordem numérica.
        #[allow(clippy::cast_possible_truncation)]
        por_tick.entry(nota.tick as i64).or_default().push(*nota);
    }
    por_tick
        .into_values()
        .flat_map(|acorde| {
            if acorde.len() > 1 {
                acorde.into_iter().filter(|n| n.pista != PISTA_ABERTA).collect()
            } else {
                acorde
            }
        })
        .collect()
}

fn montar_notas(brutas: &[NotaEmTicks], frases: &[Trecho], mapa: &MapaDeTempo, resolucao: f64) -> Vec<Nota> {
    let mut brutas = tirar_abertas_dos_acordes(brutas);
    brutas.sort_by(|a, b| a.tick.total_cmp(&b.tick).then(a.pista.cmp(&b.pista)));
    // Sustains muito curtos viram notas simples, como no Clone Hero.
    let sustain_minimo = resolucao / 3.0;
    brutas
        .iter()
        .map(|n| {
            let tempo = mapa.em_segundos(n.tick);
            let frase = frases.iter().position(|f| n.tick >= f.tick && n.tick < f.tick + f.duracao);
            Nota {
                tempo,
                pista: n.pista,
                frase: frase.and_then(|i| i32::try_from(i).ok()).unwrap_or(-1),
                duracao: if n.duracao >= sustain_minimo {
                    mapa.em_segundos(n.tick + n.duracao) - tempo
                } else {
                    0.0
                },
            }
        })
        .collect()
}

fn guardar(trilhas: &mut Trilhas, instrumento: usize, dificuldade: Dificuldade, brutas: &[NotaEmTicks], frases: &[Trecho], mapa: &MapaDeTempo, resolucao: f64) {
    let notas = montar_notas(brutas, frases, mapa, resolucao);
    if !notas.is_empty() {
        trilhas.insert((instrumento, dificuldade), notas);
    }
}

/// O `Number(texto) || padrao` do JavaScript, para os números que o chart escreve.
fn numero_ou(texto: &str, padrao: f64) -> f64 {
    let texto = texto.trim();
    if texto.is_empty() {
        return padrao;
    }
    match texto.parse::<f64>() {
        Ok(valor) if valor != 0.0 && !valor.is_nan() => valor,
        _ => padrao,
    }
}

fn prefixo_do_chart(dificuldade: Dificuldade) -> &'static str {
    match dificuldade {
        Dificuldade::Facil => "Easy",
        Dificuldade::Medio => "Medium",
        Dificuldade::Dificil => "Hard",
        Dificuldade::Expert => "Expert",
    }
}

fn instrumento_do_chart(instrumento: Instrumento) -> &'static str {
    match instrumento {
        Instrumento::Guitarra => "Single",
        Instrumento::Baixo => "DoubleBass",
        Instrumento::Ritmica => "DoubleRhythm",
        Instrumento::Coop => "DoubleGuitar",
        Instrumento::Teclado => "Keyboard",
    }
}

/// Formato .chart, em texto.
// Os padrões são fixos e testados: compilar não falha.
#[allow(clippy::missing_panics_doc, clippy::unwrap_used)]
pub fn ler_chart(conteudo: &str) -> ChartLido {
    let secao = Regex::new(r"\[([^\]]+)\]\s*\{([^}]*)\}").unwrap();
    let andamento = Regex::new(r"^(\d+)\s*=\s*B\s+(\d+)").unwrap();
    let nota = Regex::new(r"^(\d+)\s*=\s*([NS])\s+(\d+)\s+(\d+)").unwrap();

    let mut secoes: HashMap<String, Vec<String>> = HashMap::new();
    for captura in secao.captures_iter(conteudo) {
        let linhas = captura[2].split('\n').map(|l| l.trim().to_owned()).filter(|l| !l.is_empty()).collect();
        secoes.insert(captura[1].trim().to_owned(), linhas);
    }
    let resolucao = secoes
        .get("Song")
        .and_then(|linhas| {
            linhas.iter().rev().find_map(|linha| {
                let (chave, valor) = linha.split_once('=')?;
                (chave.trim() == "Resolution").then(|| valor.trim().to_owned())
            })
        })
        .map_or(192.0, |valor| numero_ou(&valor, 192.0));

    let andamentos: Vec<(f64, f64)> = secoes
        .get("SyncTrack")
        .into_iter()
        .flatten()
        .filter_map(|linha| {
            let c = andamento.captures(linha)?;
            Some((numero_ou(&c[1], 0.0), 60e9 / numero_ou(&c[2], 0.0)))
        })
        .collect();
    let mapa = MapaDeTempo::new(resolucao, &andamentos);

    let mut trilhas = Trilhas::new();
    for (indice, &instrumento) in INSTRUMENTOS.iter().enumerate() {
        for dificuldade in DIFICULDADES {
            let Some(linhas) = secoes.get(&format!("{}{}", prefixo_do_chart(dificuldade), instrumento_do_chart(instrumento))) else {
                continue;
            };
            let mut brutas = Vec::new();
            let mut frases = Vec::new();
            for linha in linhas {
                let Some(c) = nota.captures(linha) else { continue };
                let tick = numero_ou(&c[1], 0.0);
                let valor = numero_ou(&c[3], 0.0);
                let duracao = numero_ou(&c[4], 0.0);
                match (&c[2], valor) {
                    ("N", v) if v <= 4.0 => brutas.push(NotaEmTicks {
                        tick,
                        // De 0 a 4, sem perda.
                        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
                        pista: v as u8,
                        duracao,
                    }),
                    ("N", 7.0) => brutas.push(NotaEmTicks {
                        tick,
                        pista: PISTA_ABERTA,
                        duracao,
                    }),
                    ("S", 2.0) => frases.push(Trecho { tick, duracao }),
                    _ => {}
                }
            }
            guardar(&mut trilhas, indice, dificuldade, &brutas, &frases, &mapa, resolucao);
        }
    }
    ChartLido { trilhas }
}

fn base_do_midi(dificuldade: Dificuldade) -> u8 {
    match dificuldade {
        Dificuldade::Facil => 60,
        Dificuldade::Medio => 72,
        Dificuldade::Dificil => 84,
        Dificuldade::Expert => 96,
    }
}

/// Dificuldade nos sysex do Phase Shift: 0 é o fácil, 3 o expert, 0xFF todas.
fn dificuldade_do_sysex(dificuldade: Dificuldade) -> u8 {
    match dificuldade {
        Dificuldade::Facil => 0,
        Dificuldade::Medio => 1,
        Dificuldade::Dificil => 2,
        Dificuldade::Expert => 3,
    }
}

const SYSEX_ABERTA: u8 = 1;

fn instrumento_da_faixa(nome: &str) -> Option<Instrumento> {
    match nome {
        "PART GUITAR" | "T1 GEMS" => Some(Instrumento::Guitarra),
        "PART BASS" => Some(Instrumento::Baixo),
        "PART RHYTHM" => Some(Instrumento::Ritmica),
        "PART GUITAR COOP" => Some(Instrumento::Coop),
        "PART KEYS" => Some(Instrumento::Teclado),
        _ => None,
    }
}

struct NotaMidi {
    tick: f64,
    nota: u8,
    duracao: f64,
}

struct Sysex {
    tick: f64,
    dificuldade: u8,
    tipo: u8,
    duracao: f64,
}

struct Faixa {
    nome: String,
    notas: Vec<NotaMidi>,
    aberturas_melhoradas: bool,
    sysex: Vec<Sysex>,
    /// (tick, microssegundos por semínima). Valem para o arquivo inteiro, venham de qual faixa vierem.
    andamentos: Vec<(f64, f64)>,
}

/// Trechos marcados por notas MIDI ou sysex: vale do início até antes do fim (ou só o tick, se não durar nada).
fn dentro(trechos: &[Trecho], tick: f64) -> bool {
    trechos
        .iter()
        .any(|t| tick >= t.tick && (tick < t.tick + t.duracao || (t.duracao == 0.0 && tick == t.tick)))
}

fn ler_faixa(dados: &[u8], inicio: usize, fim: usize) -> Faixa {
    // Leituras fora do arquivo valem 0, como o `undefined` virando 0 nas contas de bits do app.
    let byte = |p: usize| dados.get(p).copied().unwrap_or(0);
    let mut p = inicio;
    let mut tick: f64 = 0.0;
    let mut status = 0u8;
    let mut faixa = Faixa {
        nome: String::new(),
        notas: Vec::new(),
        aberturas_melhoradas: false,
        sysex: Vec::new(),
        andamentos: Vec::new(),
    };
    let mut abertas: HashMap<u8, f64> = HashMap::new();
    let mut sysex_ligados: HashMap<(u8, u8), f64> = HashMap::new();
    let quantidade_variavel = |p: &mut usize| {
        let mut valor: i32 = 0;
        loop {
            let b = byte(*p);
            *p += 1;
            valor = (valor << 7) | i32::from(b & 0x7f);
            if b & 0x80 == 0 {
                return valor;
            }
        }
    };
    let texto = |de: usize, tamanho: usize| String::from_utf8_lossy(dados.get(de..(de + tamanho).min(dados.len())).unwrap_or_default()).into_owned();

    while p < fim {
        tick += f64::from(quantidade_variavel(&mut p));
        // Sem o bit alto, o evento reaproveita o status anterior ("running status").
        if byte(p) & 0x80 != 0 {
            status = byte(p);
            p += 1;
        }
        if status == 0xff {
            let tipo = byte(p);
            p += 1;
            let tamanho = usize::try_from(quantidade_variavel(&mut p)).unwrap_or(0);
            if tipo == 0x03 {
                faixa.nome = texto(p, tamanho);
            }
            // Com este texto, a nota logo abaixo do verde de cada dificuldade é a aberta.
            if tipo == 0x01 && texto(p, tamanho).contains("ENHANCED_OPENS") {
                faixa.aberturas_melhoradas = true;
            }
            if tipo == 0x51 {
                let microssegundos = (u32::from(byte(p)) << 16) | (u32::from(byte(p + 1)) << 8) | u32::from(byte(p + 2));
                faixa.andamentos.push((tick, f64::from(microssegundos)));
            }
            p += tamanho;
        } else if status == 0xf0 || status == 0xf7 {
            let tamanho = usize::try_from(quantidade_variavel(&mut p)).unwrap_or(0);
            // Phase Shift: "PS", 0, 0, dificuldade, tipo, liga/desliga. Marca trechos de notas abertas ou tap.
            if tamanho >= 7 && byte(p) == 0x50 && byte(p + 1) == 0x53 && byte(p + 2) == 0 && byte(p + 3) == 0 {
                let (dificuldade, tipo, liga) = (byte(p + 4), byte(p + 5), byte(p + 6));
                let chave = (dificuldade, tipo);
                if liga != 0 {
                    sysex_ligados.insert(chave, tick);
                } else if let Some(inicio) = sysex_ligados.remove(&chave) {
                    faixa.sysex.push(Sysex {
                        tick: inicio,
                        dificuldade,
                        tipo,
                        duracao: tick - inicio,
                    });
                }
            }
            p += tamanho;
        } else {
            let tipo = status & 0xf0;
            let nota = byte(p);
            p += 1;
            let velocidade = if tipo == 0xc0 || tipo == 0xd0 {
                0
            } else {
                p += 1;
                byte(p - 1)
            };
            if tipo == 0x90 && velocidade > 0 {
                abertas.insert(nota, tick);
            } else if tipo == 0x80 || tipo == 0x90 {
                if let Some(inicio) = abertas.remove(&nota) {
                    faixa.notas.push(NotaMidi {
                        tick: inicio,
                        nota,
                        duracao: tick - inicio,
                    });
                }
            }
        }
    }
    faixa.nome = faixa.nome.trim().to_uppercase();
    faixa
}

/// Formato notes.mid, o MIDI do Rock Band e do Clone Hero.
pub fn ler_midi(dados: &[u8]) -> Result<ChartLido, ErroDoChart> {
    if dados.len() < 14 || &dados[..4] != b"MThd" {
        return Err(ErroDoChart::MidiInvalido);
    }
    let u32_em = |p: usize| dados.get(p..p + 4).map_or(0, |b| u32::from_be_bytes([b[0], b[1], b[2], b[3]]));
    let quantidade_de_faixas = u16::from_be_bytes([dados[10], dados[11]]);
    let resolucao = match u16::from_be_bytes([dados[12], dados[13]]) {
        0 => 480.0,
        r => f64::from(r),
    };

    let mut posicao = 8 + u32_em(4) as usize;
    let mut faixas = Vec::new();
    for _ in 0..quantidade_de_faixas {
        if posicao >= dados.len() {
            break;
        }
        let inicio = posicao + 8;
        let fim = inicio + u32_em(posicao + 4) as usize;
        posicao = fim;
        faixas.push(ler_faixa(dados, inicio, fim));
    }
    let andamentos: Vec<(f64, f64)> = faixas.iter().flat_map(|f| f.andamentos.iter().copied()).collect();
    let mapa = MapaDeTempo::new(resolucao, &andamentos);

    let mut por_instrumento: HashMap<Instrumento, &Faixa> = HashMap::new();
    for faixa in &faixas {
        if let Some(instrumento) = instrumento_da_faixa(&faixa.nome) {
            if !faixa.notas.is_empty() {
                por_instrumento.entry(instrumento).or_insert(faixa);
            }
        }
    }
    // MIDI antigo, sem nome nas faixas: a que tem notas de guitarra é a guitarra.
    if por_instrumento.is_empty() {
        if let Some(sem_nome) = faixas.iter().find(|f| f.notas.iter().any(|n| (60..=100).contains(&n.nota))) {
            por_instrumento.insert(Instrumento::Guitarra, sem_nome);
        }
    }

    let mut trilhas = Trilhas::new();
    for (indice, instrumento) in INSTRUMENTOS.iter().enumerate() {
        let Some(faixa) = por_instrumento.get(instrumento) else { continue };
        let frases: Vec<Trecho> = faixa
            .notas
            .iter()
            .filter(|n| n.nota == 116)
            .map(|n| Trecho {
                tick: n.tick,
                duracao: n.duracao,
            })
            .collect();
        for dificuldade in DIFICULDADES {
            let base = base_do_midi(dificuldade);
            let trechos_abertos: Vec<Trecho> = faixa
                .sysex
                .iter()
                .filter(|s| s.tipo == SYSEX_ABERTA && (s.dificuldade == dificuldade_do_sysex(dificuldade) || s.dificuldade == 0xff))
                .map(|s| Trecho {
                    tick: s.tick,
                    duracao: s.duracao,
                })
                .collect();
            let mut brutas = Vec::new();
            for n in &faixa.notas {
                if faixa.aberturas_melhoradas && n.nota == base - 1 {
                    brutas.push(NotaEmTicks {
                        tick: n.tick,
                        pista: PISTA_ABERTA,
                        duracao: n.duracao,
                    });
                } else if (base..=base + 4).contains(&n.nota) {
                    // No sysex do Phase Shift, a aberta vem escrita como verde dentro do trecho.
                    let aberta = n.nota == base && dentro(&trechos_abertos, n.tick);
                    brutas.push(NotaEmTicks {
                        tick: n.tick,
                        pista: if aberta { PISTA_ABERTA } else { n.nota - base },
                        duracao: n.duracao,
                    });
                }
            }
            guardar(&mut trilhas, indice, dificuldade, &brutas, &frases, &mapa, resolucao);
        }
    }
    Ok(ChartLido { trilhas })
}

impl ChartLido {
    /// As notas do instrumento e da dificuldade pedidos. Sem a dificuldade, vale a mais próxima (empate vai para a mais fácil);
    /// sem o instrumento, o primeiro que o chart tem.
    pub fn trilha(&self, instrumento: Instrumento, dificuldade: Dificuldade) -> Vec<Nota> {
        let pedido = INSTRUMENTOS.iter().position(|&i| i == instrumento).unwrap_or(0);
        let tem = |i: usize| self.trilhas.keys().any(|(de, _)| *de == i);
        let Some(tocado) = (if tem(pedido) {
            Some(pedido)
        } else {
            (0..INSTRUMENTOS.len()).find(|&i| tem(i))
        }) else {
            return Vec::new();
        };
        let alvo = dificuldade as i32;
        DIFICULDADES
            .iter()
            .filter(|d| self.trilhas.contains_key(&(tocado, **d)))
            .min_by_key(|d| ((**d as i32 - alvo).abs(), **d as i32))
            .and_then(|d| self.trilhas.get(&(tocado, *d)).cloned())
            .unwrap_or_default()
    }
}

/// O que importa de um .sng para julgar: o arquivo do chart e o "delay" do song.ini. Sem o áudio, cabe em poucos KB.
#[derive(Debug, Clone, PartialEq)]
pub struct ChartGuardado {
    pub arquivo: Vec<u8>,
    /// `notes.mid` em vez de `notes.chart`.
    pub midi: bool,
    /// Quanto o áudio atrasa em relação ao chart, em milissegundos.
    pub atraso_ms: f64,
}

/// O chart de um .sng que já está todo na memória.
pub fn extrair_chart(sng: &[u8]) -> Result<ChartGuardado, ErroDoChart> {
    // Sem o chart inteiro depois do pacote todo, o pacote está cortado.
    ExtratorDeChart::novo().receber(sng)?.ok_or(ErroDoChart::SngInvalido)
}

/// As notas que o app toca: o chart da trilha, já descontado o atraso.
pub fn notas_do_chart(chart: &ChartGuardado, instrumento: Instrumento, dificuldade: Dificuldade) -> Result<Vec<Nota>, ErroDoChart> {
    let lido = if chart.midi {
        ler_midi(&chart.arquivo)?
    } else {
        ler_chart(&String::from_utf8_lossy(&chart.arquivo))
    };
    let atraso = chart.atraso_ms / 1000.0;
    Ok(lido
        .trilha(instrumento, dificuldade)
        .into_iter()
        .map(|n| Nota { tempo: n.tempo - atraso, ..n })
        .collect())
}

pub fn notas_do_sng(sng: &[u8], instrumento: Instrumento, dificuldade: Dificuldade) -> Result<Vec<Nota>, ErroDoChart> {
    notas_do_chart(&extrair_chart(sng)?, instrumento, dificuldade)
}

/// O número como o JavaScript escreve: os tempos da grade nunca precisam de expoente, e o -0 vira 0.
fn como_no_javascript(valor: f64) -> String {
    if valor == 0.0 {
        "0".to_owned()
    } else {
        valor.to_string()
    }
}

/// SHA-256 das notas na grade da partida, cortado em 16 bytes (hex). O mesmo `hashDoChart` do replay do app.
pub fn hash_do_chart(notas: &[Nota]) -> String {
    let texto = notas
        .iter()
        .map(|n| {
            format!(
                "{},{},{}",
                como_no_javascript(quantizar(n.tempo)),
                n.pista,
                como_no_javascript(quantizar(n.tempo + n.duracao))
            )
        })
        .collect::<Vec<_>>()
        .join(";");
    Sha256::digest(texto.as_bytes())[..16].iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn o_mapa_segue_as_mudancas_de_andamento_e_usa_120_bpm_sem_nenhum() {
        let mapa = MapaDeTempo::new(100.0, &[(0.0, 500_000.0), (200.0, 1_000_000.0)]);
        assert!((mapa.em_segundos(300.0) - 2.0).abs() < 1e-9);
        assert!((MapaDeTempo::new(480.0, &[]).em_segundos(480.0) - 0.5).abs() < 1e-9);
    }

    #[test]
    fn aberta_junto_com_traste_fica_so_o_traste() {
        let chart = ler_chart("[Song]\n{\n Resolution = 192\n}\n[ExpertSingle]\n{\n0 = N 0 0\n0 = N 7 0\n192 = N 7 0\n}");
        let pistas: Vec<u8> = chart.trilha(Instrumento::Guitarra, Dificuldade::Expert).iter().map(|n| n.pista).collect();
        assert_eq!(pistas, [0, PISTA_ABERTA]);
    }

    #[test]
    fn sem_a_dificuldade_vale_a_mais_proxima_e_o_empate_vai_para_a_mais_facil() {
        let chart = ler_chart("[EasySingle]\n{\n0 = N 0 0\n}\n[HardSingle]\n{\n0 = N 2 0\n}");
        assert_eq!(chart.trilha(Instrumento::Guitarra, Dificuldade::Medio)[0].pista, 0);
        assert_eq!(chart.trilha(Instrumento::Baixo, Dificuldade::Expert)[0].pista, 2);
    }

    #[test]
    fn escreve_os_numeros_como_o_javascript() {
        assert_eq!(como_no_javascript(-0.0), "0");
        assert_eq!(como_no_javascript(3.0), "3");
        assert_eq!(como_no_javascript(1.234), "1.234");
    }

    /// Um .sng com o chart no meio de outros arquivos, como os do Encore.
    fn sng_com_audio() -> (Vec<u8>, Vec<u8>) {
        let chart = b"[ExpertSingle]\n{\n192 = N 0 0\n}".to_vec();
        let audio = vec![7u8; 5000];
        let mascara: Vec<u8> = (0..16).map(|i| (i * 37 + 11) as u8).collect();
        let metadados = {
            let mut m = Vec::new();
            m.extend(2u64.to_le_bytes());
            for (chave, valor) in [("Name", "Teste"), ("delay", "250")] {
                m.extend((chave.len() as i32).to_le_bytes());
                m.extend(chave.as_bytes());
                m.extend((valor.len() as i32).to_le_bytes());
                m.extend(valor.as_bytes());
            }
            m
        };
        let arquivos: [(&str, &[u8]); 3] = [("song.ogg", &audio), ("notes.chart", &chart), ("guitar.ogg", &audio)];
        let tamanho_do_indice = 8 + arquivos.iter().map(|(n, _)| 1 + n.len() + 16).sum::<usize>();
        let mut posicao = 26 + 8 + metadados.len() + 8 + tamanho_do_indice + 8;
        let mut pacote = b"SNGPKG".to_vec();
        pacote.extend(1u32.to_le_bytes());
        pacote.extend(&mascara);
        pacote.extend((metadados.len() as u64).to_le_bytes());
        pacote.extend(&metadados);
        pacote.extend((tamanho_do_indice as u64).to_le_bytes());
        pacote.extend((arquivos.len() as u64).to_le_bytes());
        for (nome, conteudo) in arquivos {
            pacote.push(nome.len() as u8);
            pacote.extend(nome.as_bytes());
            pacote.extend((conteudo.len() as u64).to_le_bytes());
            pacote.extend((posicao as u64).to_le_bytes());
            posicao += conteudo.len();
        }
        pacote.extend((arquivos.iter().map(|(_, c)| c.len()).sum::<usize>() as u64).to_le_bytes());
        for (_, conteudo) in arquivos {
            pacote.extend(conteudo.iter().enumerate().map(|(j, b)| b ^ mascara[j & 15] ^ (j & 0xff) as u8));
        }
        (pacote, chart)
    }

    #[test]
    fn o_extrator_tira_o_chart_em_qualquer_corte_e_para_antes_do_fim() {
        let (pacote, chart) = sng_com_audio();
        let inteiro = extrair_chart(&pacote).unwrap();
        assert_eq!((inteiro.arquivo.as_slice(), inteiro.midi, inteiro.atraso_ms), (chart.as_slice(), false, 250.0));
        for tamanho_do_pedaco in [1, 7, 64, 4096] {
            let mut extrator = ExtratorDeChart::novo();
            let mut lidos = 0;
            let mut achado = None;
            for pedaco in pacote.chunks(tamanho_do_pedaco) {
                lidos += pedaco.len();
                if let Some(chart) = extrator.receber(pedaco).unwrap() {
                    achado = Some(chart);
                    break;
                }
            }
            assert_eq!(achado.as_ref(), Some(&inteiro), "pedaços de {tamanho_do_pedaco}");
            // O segundo áudio vem depois do chart: o download para antes dele.
            assert!(lidos < pacote.len() - 5000 + tamanho_do_pedaco, "pedaços de {tamanho_do_pedaco}");
        }
    }

    #[test]
    fn o_extrator_recusa_pacote_sem_chart_e_pacote_cortado() {
        let (pacote, _) = sng_com_audio();
        let mut sem_chart = pacote.clone();
        let nome = sem_chart.windows(11).position(|w| w == b"notes.chart").unwrap();
        sem_chart[nome + 10] = b'x';
        assert_eq!(extrair_chart(&sem_chart), Err(ErroDoChart::SemChart));
        let corte = pacote.len() - 6000;
        assert_eq!(extrair_chart(&pacote[..corte]), Err(ErroDoChart::SngInvalido));
    }

    #[test]
    fn recusa_pacote_que_nao_e_sng() {
        assert!(matches!(ler_sng(b"nada"), Err(ErroDoChart::SngInvalido)));
    }
}
