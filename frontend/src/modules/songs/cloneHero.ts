import type { Batida, Dificuldade, Nota } from "./tipos";

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

/** Converte as posições do chart (ticks) em segundos, seguindo as mudanças de andamento. */
export class MapaDeTempo {
  private pontos: { tick: number; segundo: number; segundosPorTick: number }[] = [];

  constructor(
    private resolucao: number,
    andamentos: { tick: number; microssegundosPorSeminima: number }[],
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

  /** Uma batida por semínima, com tempo forte a cada 4. */
  batidas(ateSegundo: number): Batida[] {
    const batidas: Batida[] = [];
    for (let tick = 0, i = 0; ; tick += this.resolucao, i++) {
      const tempo = this.emSegundos(tick);
      if (tempo > ateSegundo + 1e-9) break;
      batidas.push({ tempo, forte: i % 4 === 0 });
    }
    return batidas;
  }
}

export interface ChartLido {
  notas: Partial<Record<Dificuldade, Nota[]>>;
  mapa: MapaDeTempo;
}

interface NotaEmTicks {
  tick: number;
  pista: number;
  duracao: number;
}

function montarNotas(brutas: NotaEmTicks[], frases: { tick: number; duracao: number }[], mapa: MapaDeTempo, resolucao: number): Nota[] {
  brutas.sort((a, b) => a.tick - b.tick || a.pista - b.pista);
  // Sustains muito curtos viram notas simples, como no Clone Hero.
  const sustainMinimo = resolucao / 3;
  return brutas.map((n) => {
    const tempo = mapa.emSegundos(n.tick);
    return {
      tempo,
      pista: n.pista,
      frase: frases.findIndex((f) => n.tick >= f.tick && n.tick < f.tick + f.duracao),
      duracao: n.duracao >= sustainMinimo ? mapa.emSegundos(n.tick + n.duracao) - tempo : 0,
    };
  });
}

const SECOES_DO_CHART: Record<Dificuldade, string> = {
  facil: "EasySingle",
  medio: "MediumSingle",
  dificil: "HardSingle",
  expert: "ExpertSingle",
};

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
  for (const linha of secoes.get("SyncTrack") ?? []) {
    // "B" guarda o BPM vezes 1000.
    const encontrado = linha.match(/^(\d+)\s*=\s*B\s+(\d+)/);
    if (encontrado) andamentos.push({ tick: Number(encontrado[1]), microssegundosPorSeminima: 60e9 / Number(encontrado[2]) });
  }
  const mapa = new MapaDeTempo(resolucao, andamentos);

  const notas: ChartLido["notas"] = {};
  for (const [dificuldade, nome] of Object.entries(SECOES_DO_CHART) as [Dificuldade, string][]) {
    const linhas = secoes.get(nome);
    if (!linhas) continue;
    const brutas: NotaEmTicks[] = [];
    const frases: { tick: number; duracao: number }[] = [];
    for (const linha of linhas) {
      const encontrado = linha.match(/^(\d+)\s*=\s*([NS])\s+(\d+)\s+(\d+)/);
      if (!encontrado) continue;
      const tick = Number(encontrado[1]);
      const valor = Number(encontrado[3]);
      const duracao = Number(encontrado[4]);
      // N 0 a 4 são os trastes; 5 e 6 são marcadores e 7 é a nota aberta, que ainda não usamos.
      if (encontrado[2] === "N" && valor <= 4) brutas.push({ tick, pista: valor, duracao });
      else if (encontrado[2] === "S" && valor === 2) frases.push({ tick, duracao });
    }
    if (brutas.length) notas[dificuldade] = montarNotas(brutas, frases, mapa, resolucao);
  }
  return { notas, mapa };
}

const NOTA_MIDI_BASE: Record<Dificuldade, number> = { facil: 60, medio: 72, dificil: 84, expert: 96 };
const NOTA_MIDI_STAR_POWER = 116;
const FAIXAS_PREFERIDAS = ["PART GUITAR", "T1 GEMS", "PART BASS", "PART RHYTHM", "PART KEYS"];

/** Formato notes.mid, o MIDI do Rock Band e do Clone Hero. */
export function lerMidi(dados: Uint8Array): ChartLido {
  const vista = new DataView(dados.buffer, dados.byteOffset, dados.byteLength);
  const decodificador = new TextDecoder();
  if (dados.length < 14 || decodificador.decode(dados.subarray(0, 4)) !== "MThd") throw new Error("notes.mid inválido.");
  const quantidadeDeFaixas = vista.getUint16(10);
  const resolucao = vista.getUint16(12) || 480;

  let posicao = 8 + vista.getUint32(4);
  const andamentos: { tick: number; microssegundosPorSeminima: number }[] = [];
  const faixas: { nome: string; notas: { tick: number; nota: number; duracao: number }[] }[] = [];

  for (let f = 0; f < quantidadeDeFaixas && posicao < dados.length; f++) {
    let p = posicao + 8;
    const fim = p + vista.getUint32(posicao + 4);
    posicao = fim;
    let tick = 0;
    let status = 0;
    let nome = "";
    const abertas = new Map<number, number>();
    const notas: { tick: number; nota: number; duracao: number }[] = [];
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
        if (tipo === 0x03) nome = decodificador.decode(dados.subarray(p, p + tamanho));
        if (tipo === 0x51) andamentos.push({ tick, microssegundosPorSeminima: (dados[p] << 16) | (dados[p + 1] << 8) | dados[p + 2] });
        p += tamanho;
      } else if (status === 0xf0 || status === 0xf7) {
        p += quantidadeVariavel();
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
    faixas.push({ nome: nome.trim().toUpperCase(), notas });
  }

  const mapa = new MapaDeTempo(resolucao, andamentos);
  const guitarra =
    FAIXAS_PREFERIDAS.map((n) => faixas.find((f) => f.nome === n)).find((f) => f?.notas.length) ??
    faixas.find((f) => f.notas.some((n) => n.nota >= 60 && n.nota <= 100));

  const notas: ChartLido["notas"] = {};
  if (guitarra) {
    const frases = guitarra.notas.filter((n) => n.nota === NOTA_MIDI_STAR_POWER).map((n) => ({ tick: n.tick, duracao: n.duracao }));
    for (const [dificuldade, base] of Object.entries(NOTA_MIDI_BASE) as [Dificuldade, number][]) {
      const brutas = guitarra.notas
        .filter((n) => n.nota >= base && n.nota <= base + 4)
        .map((n) => ({ tick: n.tick, pista: n.nota - base, duracao: n.duracao }));
      if (brutas.length) notas[dificuldade] = montarNotas(brutas, frases, mapa, resolucao);
    }
  }
  return { notas, mapa };
}

const ORDEM: Dificuldade[] = ["facil", "medio", "dificil", "expert"];

/** A dificuldade pedida ou, se o chart não tiver, a mais próxima (empate vai para a mais fácil). */
export function escolherDificuldade(chart: ChartLido, dificuldade: Dificuldade): Nota[] {
  const alvo = ORDEM.indexOf(dificuldade);
  const porDistancia = [...ORDEM].sort((a, b) => Math.abs(ORDEM.indexOf(a) - alvo) - Math.abs(ORDEM.indexOf(b) - alvo));
  for (const d of porDistancia) if (chart.notas[d]?.length) return chart.notas[d]!;
  return [];
}
