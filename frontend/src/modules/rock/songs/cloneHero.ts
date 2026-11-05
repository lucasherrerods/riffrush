import { dificuldadeMaisProxima } from "./dificuldades";
import { secaoDoEvento } from "./secoes";
import { DIFICULDADES, INSTRUMENTOS, PISTA_ABERTA, type Batida, type Dificuldade, type Instrumento, type Nota, type Secao, type TipoDaNota, type Trilhas } from "./tipos";

/*
 * Formatos do Clone Hero.
 *
 * .sng é um pacote com os arquivos de uma pasta de música (chart, faixas de áudio,
 * capa, vídeo) e os metadados do song.ini. Layout, em little-endian:
 *   "SNGPKG" | versão u32 | máscara[16]
 *   tamanho u64 | quantidade u64 | (tamanho i32, chave, tamanho i32, valor)*
 *   tamanho u64 | quantidade u64 | (tamanho u8, nome, tamanho u64, posição u64)*
 *   tamanho u64 | conteúdo dos arquivos, mascarado com XOR
 */

export interface PacoteSng {
  metadados: Record<string, string>;
  arquivos: Map<string, Uint8Array>;
}

export function lerSng(buffer: ArrayBufferLike): PacoteSng {
  const vista = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decodificador = new TextDecoder();
  if (bytes.length < 26 || decodificador.decode(bytes.subarray(0, 6)) !== "SNGPKG") throw new Error("Arquivo .sng inválido.");
  const mascara = bytes.slice(10, 26);
  let posicao = 26;
  const u64 = () => {
    const valor = Number(vista.getBigUint64(posicao, true));
    posicao += 8;
    return valor;
  };
  const i32 = () => {
    const valor = vista.getInt32(posicao, true);
    posicao += 4;
    return valor;
  };
  const texto = (tamanho: number) => {
    const valor = decodificador.decode(bytes.subarray(posicao, posicao + tamanho));
    posicao += tamanho;
    return valor;
  };

  const metadados: Record<string, string> = {};
  u64();
  const quantidadeDeMetadados = u64();
  for (let i = 0; i < quantidadeDeMetadados; i++) {
    const chave = texto(i32());
    metadados[chave.toLowerCase()] = texto(i32());
  }

  const arquivos = new Map<string, Uint8Array>();
  u64();
  const quantidadeDeArquivos = u64();
  for (let i = 0; i < quantidadeDeArquivos; i++) {
    const nome = texto(bytes[posicao++]).toLowerCase();
    const tamanho = u64();
    const inicio = u64();
    const conteudo = bytes.slice(inicio, inicio + tamanho);
    for (let j = 0; j < conteudo.length; j++) conteudo[j] ^= mascara[j & 15] ^ (j & 0xff);
    arquivos.set(nome, conteudo);
  }
  return { metadados, arquivos };
}

const ANDAMENTO_PADRAO = 500000;

export interface Compasso {
  tick: number;
  numerador: number;
  denominador: number;
}

/** Converte as posições do chart (ticks) em segundos, seguindo as mudanças de andamento. */
export class MapaDeTempo {
  private pontos: { tick: number; segundo: number; segundosPorTick: number }[] = [];

  constructor(
    private resolucao: number,
    andamentos: { tick: number; microssegundosPorSeminima: number }[],
    private compassos: Compasso[] = [],
  ) {
    const ordenados = [...andamentos].sort((a, b) => a.tick - b.tick);
    if (!ordenados.length || ordenados[0].tick > 0) ordenados.unshift({ tick: 0, microssegundosPorSeminima: ANDAMENTO_PADRAO });
    let segundo = 0;
    ordenados.forEach((andamento, i) => {
      if (i > 0) segundo += (andamento.tick - ordenados[i - 1].tick) * this.pontos[i - 1].segundosPorTick;
      this.pontos.push({ tick: andamento.tick, segundo, segundosPorTick: andamento.microssegundosPorSeminima / 1e6 / resolucao });
    });
  }

  emSegundos(tick: number) {
    let baixo = 0;
    let alto = this.pontos.length - 1;
    while (baixo < alto) {
      const meio = (baixo + alto + 1) >> 1;
      if (this.pontos[meio].tick <= tick) baixo = meio;
      else alto = meio - 1;
    }
    const ponto = this.pontos[baixo];
    return ponto.segundo + (tick - ponto.tick) * ponto.segundosPorTick;
  }

  /** Uma batida por semínima, com tempo forte no começo de cada compasso (4/4 se o chart não disser). */
  batidas(ateSegundo: number): Batida[] {
    const compassos = [...this.compassos].sort((a, b) => a.tick - b.tick);
    if (!compassos.length || compassos[0].tick > 0) compassos.unshift({ tick: 0, numerador: 4, denominador: 4 });
    const fortes = new Set<number>();
    compassos.forEach((compasso, i) => {
      const tamanho = Math.max(1, Math.round((compasso.numerador * 4 * this.resolucao) / compasso.denominador));
      const ate = compassos[i + 1]?.tick ?? Infinity;
      for (let tick = compasso.tick; tick < ate && this.emSegundos(tick) <= ateSegundo + 1e-9; tick += tamanho) fortes.add(tick);
    });
    const batidas: Batida[] = [];
    for (let tick = 0; ; tick += this.resolucao) {
      const tempo = this.emSegundos(tick);
      if (tempo > ateSegundo + 1e-9) break;
      batidas.push({ tempo, forte: fortes.has(tick) });
    }
    return batidas;
  }
}

export interface ChartLido {
  notas: Partial<Record<Instrumento, Partial<Record<Dificuldade, Nota[]>>>>;
  mapa: MapaDeTempo;
  /** As partes da música marcadas pelo autor do chart (intro, verso, solo), em ordem. */
  secoes: Secao[];
}

function lerSecoes(eventos: { tick: number; texto: string }[], mapa: MapaDeTempo): Secao[] {
  return eventos
    .map((e) => ({ tick: e.tick, nome: secaoDoEvento(e.texto) }))
    .filter((e): e is { tick: number; nome: string } => e.nome !== null)
    .sort((a, b) => a.tick - b.tick)
    .map((e) => ({ nome: e.nome, inicio: mapa.emSegundos(e.tick) }));
}

interface NotaEmTicks {
  tick: number;
  pista: number;
  duracao: number;
}

/** O que o chart diz sobre todas as notas de um mesmo tick. */
interface Marcas {
  /** .chart: o marcador 5 inverte o HOPO natural. */
  inverter?: boolean;
  /** .mid: as notas de forçar dizem direto se é HOPO ou comum. */
  forcar?: "hopo" | "comum";
  tap?: boolean;
}

type NotaClassificada = NotaEmTicks & { tipo?: TipoDaNota };

/**
 * Decide o tipo de cada acorde, como o Clone Hero: nota simples perto da anterior (até `limiar` ticks)
 * e que não estava nela é HOPO natural; as marcas do chart mudam isso, e o tap vale por cima de tudo.
 * Uma nota aberta junto com trastes não existe no Clone Hero: fica só o traste.
 */
function classificar(brutas: NotaEmTicks[], limiar: number, marcasEm: (tick: number) => Marcas): NotaClassificada[] {
  const porTick = new Map<number, NotaEmTicks[]>();
  for (const nota of brutas) porTick.set(nota.tick, [...(porTick.get(nota.tick) ?? []), nota]);
  const saida: NotaClassificada[] = [];
  let anterior: { tick: number; pistas: Set<number> } | null = null;
  for (const tick of [...porTick.keys()].sort((a, b) => a - b)) {
    let acorde = porTick.get(tick)!;
    if (acorde.length > 1) acorde = acorde.filter((n) => n.pista !== PISTA_ABERTA);
    const pistas = new Set(acorde.map((n) => n.pista));
    const natural = pistas.size === 1 && anterior !== null && tick - anterior.tick <= limiar && !anterior.pistas.has(acorde[0].pista);
    const marcas = marcasEm(tick);
    const hopo = marcas.forcar ? marcas.forcar === "hopo" : natural !== !!marcas.inverter;
    const tipo: TipoDaNota | undefined = marcas.tap ? "tap" : hopo ? "hopo" : undefined;
    for (const nota of acorde) saida.push(tipo ? { ...nota, tipo } : nota);
    anterior = { tick, pistas };
  }
  return saida;
}

/** Trechos marcados por notas MIDI ou sysex: vale do início até antes do fim (ou só o tick, se não durar nada). */
const dentro = (trechos: { tick: number; duracao: number }[], tick: number) =>
  trechos.some((t) => tick >= t.tick && (tick < t.tick + t.duracao || (t.duracao === 0 && tick === t.tick)));

function montarNotas(brutas: NotaClassificada[], frases: { tick: number; duracao: number }[], solos: { tick: number; duracao: number }[], mapa: MapaDeTempo, resolucao: number): Nota[] {
  brutas.sort((a, b) => a.tick - b.tick || a.pista - b.pista);
  // Sustains muito curtos viram notas simples, como no Clone Hero.
  const sustainMinimo = resolucao / 3;
  return brutas.map((n) => {
    const tempo = mapa.emSegundos(n.tick);
    return {
      tempo,
      pista: n.pista,
      ...(n.tipo && { tipo: n.tipo }),
      frase: frases.findIndex((f) => n.tick >= f.tick && n.tick < f.tick + f.duracao),
      duracao: n.duracao >= sustainMinimo ? mapa.emSegundos(n.tick + n.duracao) - tempo : 0,
      solo: solos.findIndex((f) => n.tick >= f.tick && n.tick < f.tick + f.duracao),
    };
  });
}

const PREFIXOS_DO_CHART: Record<Dificuldade, string> = { facil: "Easy", medio: "Medium", dificil: "Hard", expert: "Expert" };
const INSTRUMENTOS_DO_CHART: Record<Instrumento, string> = {
  guitarra: "Single",
  baixo: "DoubleBass",
  ritmica: "DoubleRhythm",
  coop: "DoubleGuitar",
  teclado: "Keyboard",
};

/** Guarda as notas de uma trilha, criando o instrumento na primeira vez. */
function guardarTrilha(notas: ChartLido["notas"], instrumento: Instrumento, dificuldade: Dificuldade, trilha: Nota[]) {
  (notas[instrumento] ??= {})[dificuldade] = trilha;
}

/** Distância máxima, em ticks, para uma nota virar HOPO natural, como o Clone Hero: no .chart, 65/192 de semínima
 * arredondado para baixo; no .mid, um terço de semínima mais um tick. O motor em Rust usa os mesmos. */
const limiarDoChart = (resolucao: number) => Math.floor((65 / 192) * resolucao);
const limiarDoMidi = (resolucao: number) => Math.floor(resolucao / 3) + 1;

/** Formato .chart, em texto. */
export function lerChart(conteudo: string): ChartLido {
  const secoes = new Map<string, string[]>();
  for (const [, nome, corpo] of conteudo.matchAll(/\[([^\]]+)\]\s*\{([^}]*)\}/g)) {
    secoes.set(
      nome.trim(),
      corpo
        .split(/\r?\n/)
        .map((linha) => linha.trim())
        .filter(Boolean),
    );
  }
  const musica = Object.fromEntries(
    (secoes.get("Song") ?? []).map((linha) => {
      const [chave, ...valor] = linha.split("=");
      return [chave.trim(), valor.join("=").trim()];
    }),
  );
  const resolucao = Number(musica.Resolution) || 192;

  const andamentos: { tick: number; microssegundosPorSeminima: number }[] = [];
  const compassos: Compasso[] = [];
  for (const linha of secoes.get("SyncTrack") ?? []) {
    // "B" guarda o BPM vezes 1000.
    const encontrado = linha.match(/^(\d+)\s*=\s*B\s+(\d+)/);
    if (encontrado) andamentos.push({ tick: Number(encontrado[1]), microssegundosPorSeminima: 60e9 / Number(encontrado[2]) });
    // "TS" traz o numerador e, opcional, o denominador como potência de 2 (3 = colcheia).
    const compasso = linha.match(/^(\d+)\s*=\s*TS\s+(\d+)(?:\s+(\d+))?/);
    if (compasso) compassos.push({ tick: Number(compasso[1]), numerador: Number(compasso[2]), denominador: 2 ** Number(compasso[3] ?? 2) });
  }
  const mapa = new MapaDeTempo(resolucao, andamentos, compassos);

  const eventos = (secoes.get("Events") ?? []).flatMap((linha) => {
    const encontrado = linha.match(/^(\d+)\s*=\s*E\s+"?([^"]*)"?/);
    return encontrado ? [{ tick: Number(encontrado[1]), texto: encontrado[2] }] : [];
  });

  const notas: ChartLido["notas"] = {};
  for (const { id: instrumento } of INSTRUMENTOS) for (const { id: dificuldade } of DIFICULDADES) {
    const linhas = secoes.get(PREFIXOS_DO_CHART[dificuldade] + INSTRUMENTOS_DO_CHART[instrumento]);
    if (!linhas) continue;
    const brutas: NotaEmTicks[] = [];
    const frases: { tick: number; duracao: number }[] = [];
    const solos: { tick: number; duracao: number }[] = [];
    let soloAberto: number | null = null;
    const marcas = new Map<number, Marcas>();
    for (const linha of linhas) {
      // Os solos vêm como eventos locais da trilha: "E solo" abre, "E soloend" fecha.
      const evento = linha.match(/^(\d+)\s*=\s*E\s+(\S+)/);
      if (evento) {
        if (evento[2] === "solo") soloAberto = Number(evento[1]);
        else if (evento[2] === "soloend" && soloAberto !== null) {
          solos.push({ tick: soloAberto, duracao: Number(evento[1]) - soloAberto + 1 });
          soloAberto = null;
        }
        continue;
      }
      const encontrado = linha.match(/^(\d+)\s*=\s*([NS])\s+(\d+)\s+(\d+)/);
      if (!encontrado) continue;
      const tick = Number(encontrado[1]);
      const valor = Number(encontrado[3]);
      const duracao = Number(encontrado[4]);
      // N 0 a 4 são os trastes e 7 a nota aberta; 5 inverte o HOPO e 6 é o tap das notas do mesmo tick.
      if (encontrado[2] === "N" && valor <= 4) brutas.push({ tick, pista: valor, duracao });
      else if (encontrado[2] === "N" && valor === 7) brutas.push({ tick, pista: PISTA_ABERTA, duracao });
      else if (encontrado[2] === "N" && (valor === 5 || valor === 6)) marcas.set(tick, { ...marcas.get(tick), [valor === 5 ? "inverter" : "tap"]: true });
      else if (encontrado[2] === "S" && valor === 2) frases.push({ tick, duracao });
    }
    const classificadas = classificar(brutas, limiarDoChart(resolucao), (tick) => marcas.get(tick) ?? {});
    if (classificadas.length) guardarTrilha(notas, instrumento, dificuldade, montarNotas(classificadas, frases, solos, mapa, resolucao));
  }
  return { notas, mapa, secoes: lerSecoes(eventos, mapa) };
}

const NOTA_MIDI_BASE: Record<Dificuldade, number> = { facil: 60, medio: 72, dificil: 84, expert: 96 };
const NOTA_MIDI_STAR_POWER = 116;
/** Somadas à base da dificuldade: forçam HOPO ou nota comum. */
const FORCAR_HOPO = 5;
const FORCAR_COMUM = 6;
const NOTA_MIDI_TAP = 104;
const NOTA_MIDI_SOLO = 103;
/** Dificuldade nos sysex do Phase Shift: 0 é o fácil, 3 o expert, 0xFF todas. */
const DIFICULDADE_DO_SYSEX: Record<Dificuldade, number> = { facil: 0, medio: 1, dificil: 2, expert: 3 };
const SYSEX_ABERTA = 1;
const SYSEX_TAP = 4;
const FAIXAS_DO_MIDI: Record<string, Instrumento> = {
  "PART GUITAR": "guitarra",
  "T1 GEMS": "guitarra",
  "PART BASS": "baixo",
  "PART RHYTHM": "ritmica",
  "PART GUITAR COOP": "coop",
  "PART KEYS": "teclado",
};

/** Formato notes.mid, o MIDI do Rock Band e do Clone Hero. */
export function lerMidi(dados: Uint8Array): ChartLido {
  const vista = new DataView(dados.buffer, dados.byteOffset, dados.byteLength);
  const decodificador = new TextDecoder();
  if (dados.length < 14 || decodificador.decode(dados.subarray(0, 4)) !== "MThd") throw new Error("notes.mid inválido.");
  const quantidadeDeFaixas = vista.getUint16(10);
  const resolucao = vista.getUint16(12) || 480;

  let posicao = 8 + vista.getUint32(4);
  const andamentos: { tick: number; microssegundosPorSeminima: number }[] = [];
  const compassos: Compasso[] = [];
  const faixas: {
    nome: string;
    notas: { tick: number; nota: number; duracao: number }[];
    aberturasMelhoradas: boolean;
    sysex: { tick: number; dificuldade: number; tipo: number; duracao: number }[];
    textos: { tick: number; texto: string }[];
  }[] = [];

  for (let f = 0; f < quantidadeDeFaixas && posicao < dados.length; f++) {
    let p = posicao + 8;
    const fim = p + vista.getUint32(posicao + 4);
    posicao = fim;
    let tick = 0;
    let status = 0;
    let nome = "";
    const abertas = new Map<number, number>();
    const notas: { tick: number; nota: number; duracao: number }[] = [];
    let aberturasMelhoradas = false;
    const sysex: (typeof faixas)[number]["sysex"] = [];
    const sysexLigados = new Map<string, number>();
    const textos: { tick: number; texto: string }[] = [];
    const quantidadeVariavel = () => {
      let valor = 0;
      let byte: number;
      do {
        byte = dados[p++];
        valor = (valor << 7) | (byte & 0x7f);
      } while (byte & 0x80);
      return valor;
    };

    while (p < fim) {
      tick += quantidadeVariavel();
      // Sem o bit alto, o evento reaproveita o status anterior ("running status").
      if (dados[p] & 0x80) status = dados[p++];
      if (status === 0xff) {
        const tipo = dados[p++];
        const tamanho = quantidadeVariavel();
        if (tipo === 0x01 || tipo === 0x05) textos.push({ tick, texto: decodificador.decode(dados.subarray(p, p + tamanho)) });
        if (tipo === 0x03) nome = decodificador.decode(dados.subarray(p, p + tamanho));
        // Com este texto, a nota logo abaixo do verde de cada dificuldade é a aberta.
        if (tipo === 0x01 && decodificador.decode(dados.subarray(p, p + tamanho)).includes("ENHANCED_OPENS")) aberturasMelhoradas = true;
        if (tipo === 0x58) compassos.push({ tick, numerador: dados[p], denominador: 2 ** dados[p + 1] });
        if (tipo === 0x51) andamentos.push({ tick, microssegundosPorSeminima: (dados[p] << 16) | (dados[p + 1] << 8) | dados[p + 2] });
        p += tamanho;
      } else if (status === 0xf0 || status === 0xf7) {
        const tamanho = quantidadeVariavel();
        // Phase Shift: "PS", 0, 0, dificuldade, tipo, liga/desliga. Marca trechos de notas abertas ou tap.
        if (tamanho >= 7 && dados[p] === 0x50 && dados[p + 1] === 0x53 && dados[p + 2] === 0 && dados[p + 3] === 0) {
          const [dificuldade, tipoDoSysex, liga] = [dados[p + 4], dados[p + 5], dados[p + 6]];
          const chave = `${dificuldade}:${tipoDoSysex}`;
          const inicio = sysexLigados.get(chave);
          if (liga) sysexLigados.set(chave, tick);
          else if (inicio !== undefined) {
            sysex.push({ tick: inicio, dificuldade, tipo: tipoDoSysex, duracao: tick - inicio });
            sysexLigados.delete(chave);
          }
        }
        p += tamanho;
      } else {
        const tipo = status & 0xf0;
        const nota = dados[p++];
        const velocidade = tipo === 0xc0 || tipo === 0xd0 ? 0 : dados[p++];
        if (tipo === 0x90 && velocidade > 0) {
          abertas.set(nota, tick);
        } else if (tipo === 0x80 || tipo === 0x90) {
          const inicio = abertas.get(nota);
          if (inicio !== undefined) {
            notas.push({ tick: inicio, nota, duracao: tick - inicio });
            abertas.delete(nota);
          }
        }
      }
    }
    faixas.push({ nome: nome.trim().toUpperCase(), notas, aberturasMelhoradas, sysex, textos });
  }

  const mapa = new MapaDeTempo(resolucao, andamentos, compassos);
  const porInstrumento = new Map<Instrumento, (typeof faixas)[number]>();
  for (const faixa of faixas) {
    const instrumento = FAIXAS_DO_MIDI[faixa.nome];
    if (instrumento && faixa.notas.length && !porInstrumento.has(instrumento)) porInstrumento.set(instrumento, faixa);
  }
  // MIDI antigo, sem nome nas faixas: a que tem notas de guitarra é a guitarra.
  if (!porInstrumento.size) {
    const semNome = faixas.find((f) => f.notas.some((n) => n.nota >= 60 && n.nota <= 100));
    if (semNome) porInstrumento.set("guitarra", semNome);
  }

  const notas: ChartLido["notas"] = {};
  for (const { id: instrumento } of INSTRUMENTOS) {
    const faixa = porInstrumento.get(instrumento);
    if (!faixa) continue;
    const frases = faixa.notas.filter((n) => n.nota === NOTA_MIDI_STAR_POWER).map((n) => ({ tick: n.tick, duracao: n.duracao }));
    const taps = faixa.notas.filter((n) => n.nota === NOTA_MIDI_TAP);
    const solos = faixa.notas.filter((n) => n.nota === NOTA_MIDI_SOLO).map((n) => ({ tick: n.tick, duracao: n.duracao }));
    for (const [dificuldade, base] of Object.entries(NOTA_MIDI_BASE) as [Dificuldade, number][]) {
      const doSysex = (tipo: number) => faixa.sysex.filter((s) => s.tipo === tipo && (s.dificuldade === DIFICULDADE_DO_SYSEX[dificuldade] || s.dificuldade === 0xff));
      const trechosAbertos = doSysex(SYSEX_ABERTA);
      const trechosDeTap = [...taps, ...doSysex(SYSEX_TAP)];
      const forcaHopo = faixa.notas.filter((n) => n.nota === base + FORCAR_HOPO);
      const forcaComum = faixa.notas.filter((n) => n.nota === base + FORCAR_COMUM);
      const brutas: NotaEmTicks[] = [];
      for (const n of faixa.notas) {
        if (faixa.aberturasMelhoradas && n.nota === base - 1) brutas.push({ tick: n.tick, pista: PISTA_ABERTA, duracao: n.duracao });
        else if (n.nota >= base && n.nota <= base + 4) {
          // No sysex do Phase Shift, a aberta vem escrita como verde dentro do trecho.
          const aberta = n.nota === base && dentro(trechosAbertos, n.tick);
          brutas.push({ tick: n.tick, pista: aberta ? PISTA_ABERTA : n.nota - base, duracao: n.duracao });
        }
      }
      const classificadas = classificar(brutas, limiarDoMidi(resolucao), (tick) => ({
        tap: dentro(trechosDeTap, tick),
        forcar: dentro(forcaHopo, tick) ? "hopo" : dentro(forcaComum, tick) ? "comum" : undefined,
      }));
      if (classificadas.length) guardarTrilha(notas, instrumento, dificuldade, montarNotas(classificadas, frases, solos, mapa, resolucao));
    }
  }
  const eventos = faixas.find((f) => f.nome === "EVENTS")?.textos ?? [];
  return { notas, mapa, secoes: lerSecoes(eventos, mapa) };
}

export function trilhasDoChart(chart: ChartLido): Trilhas {
  const trilhas: Trilhas = {};
  for (const { id: instrumento } of INSTRUMENTOS) {
    const dificuldades = DIFICULDADES.map((d) => d.id).filter((d) => chart.notas[instrumento]?.[d]?.length);
    if (dificuldades.length) trilhas[instrumento] = dificuldades;
  }
  return trilhas;
}

/**
 * As notas do instrumento e da dificuldade pedidos. Sem a dificuldade, vale a mais próxima (empate vai para a mais fácil);
 * sem o instrumento, o primeiro que o chart tem.
 */
export function escolherTrilha(chart: ChartLido, instrumento: Instrumento, dificuldade: Dificuldade): Nota[] {
  const trilhas = trilhasDoChart(chart);
  const tocado = trilhas[instrumento] ? instrumento : INSTRUMENTOS.map((i) => i.id).find((i) => trilhas[i]);
  if (!tocado) return [];
  const escolhida = dificuldadeMaisProxima(trilhas[tocado]!, dificuldade);
  return escolhida ? chart.notas[tocado]![escolhida]! : [];
}
