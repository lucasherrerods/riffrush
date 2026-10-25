import { PISTA_ABERTA, type Nota } from "@/modules/songs";
import { ativarEstrela, avancar, quantizar, soltar, tocar, type Partida } from "./partida";

/**
 * Um replay guarda só as entradas do jogador (como o .osr do osu!), não vídeo: a partida é
 * determinística, então reaplicar as entradas sobre o mesmo chart reproduz tudo, ponto por ponto.
 */
export const VERSAO_DO_REPLAY = 2;
const TICKS_POR_SEGUNDO = 1000;
/** Quantos códigos de tecla cada versão tem: a 2 ganhou os da nota aberta. */
const CODIGOS_DA_VERSAO: Record<number, number> = { 1: 11, 2: 13 };
const CODIGOS = CODIGOS_DA_VERSAO[VERSAO_DO_REPLAY];
const ESTRELA = 10;
const APERTA_A_ABERTA = 11;
const SOLTA_A_ABERTA = 12;
const BYTES_DO_HASH = 16;

export interface EntradaDoReplay {
  /** Segundos da música, já na grade da partida. */
  tempo: number;
  tipo: "tocar" | "soltar" | "estrela";
  pista: number;
}

export interface Replay {
  semFalha: boolean;
  fantasma: boolean;
  /** Identifica o chart: o replay só vale nas mesmas notas. */
  hashDoChart: string;
  entradas: EntradaDoReplay[];
  /** Ao vivo, as entradas chegam aos poucos: a partida não passa deste tempo até chegar o lote seguinte. */
  ateAgora?: number;
}

/** O que a partida conta para quem assiste ao vivo: quem leva isso à rede é o módulo de presença. */
export type EventoDaTransmissao =
  | { tipo: "inicio"; hashDoChart: string; semFalha: boolean }
  | { tipo: "lote"; entradas: EntradaDoReplay[]; ate: number }
  | { tipo: "pausa"; pausado: boolean }
  | { tipo: "fim" };

/** Repassa as entradas para a partida e anota cada uma com o tempo que a partida de fato usou. */
export function criarGravador(partida: Partida) {
  const entradas: EntradaDoReplay[] = [];
  const anotar = (tipo: EntradaDoReplay["tipo"], pista: number) => partida.tempo !== null && entradas.push({ tempo: partida.tempo, tipo, pista });
  return {
    entradas,
    tocar(pista: number, tempo: number) {
      const acertou = tocar(partida, pista, tempo);
      anotar("tocar", pista);
      return acertou;
    },
    soltar(pista: number, tempo: number) {
      soltar(partida, pista, tempo);
      anotar("soltar", pista);
    },
    ativarEstrela() {
      const ativou = ativarEstrela(partida);
      if (ativou) anotar("estrela", 0);
      return ativou;
    },
  };
}

/** Aplica as entradas até `tempo` a partir de `indice` e devolve o próximo índice. Marca os trastes apertados. */
export function aplicarEntradas(partida: Partida, entradas: EntradaDoReplay[], indice: number, tempo: number, apertados: boolean[]) {
  for (; indice < entradas.length && entradas[indice].tempo <= tempo; indice++) {
    const entrada = entradas[indice];
    if (entrada.tipo === "tocar") {
      apertados[entrada.pista] = true;
      tocar(partida, entrada.pista, entrada.tempo);
    } else if (entrada.tipo === "soltar") {
      apertados[entrada.pista] = false;
      soltar(partida, entrada.pista, entrada.tempo);
    } else {
      avancar(partida, entrada.tempo);
      ativarEstrela(partida);
    }
  }
  return indice;
}

/** SHA-256 das notas na grade da partida, cortado em 16 bytes (hex). */
export async function hashDoChart(notas: Nota[]) {
  const texto = notas.map((n) => `${quantizar(n.tempo)},${n.pista},${quantizar(n.tempo + n.duracao)}`).join(";");
  const resumo = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(resumo).slice(0, BYTES_DO_HASH)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Versão (1 byte, fora da compressão) + deflate de: opções, hash, primeiro tempo e, para cada
 * entrada, um varint com o intervalo desde a anterior e o código da tecla. Fica com 1 a 2 bytes por entrada.
 */
export async function empacotarReplay(replay: Replay) {
  const bytes: number[] = [(replay.semFalha ? 1 : 0) | (replay.fantasma ? 2 : 0)];
  for (let i = 0; i < BYTES_DO_HASH; i++) bytes.push(parseInt(replay.hashDoChart.slice(i * 2, i * 2 + 2), 16));
  let anterior = replay.entradas.length ? emTicks(replay.entradas[0].tempo) : 0;
  escreverVarint(bytes, anterior < 0 ? -anterior * 2 - 1 : anterior * 2);
  escreverVarint(bytes, replay.entradas.length);
  for (const entrada of replay.entradas) {
    const ticks = emTicks(entrada.tempo);
    escreverVarint(bytes, (ticks - anterior) * CODIGOS + codigoDaEntrada(entrada));
    anterior = ticks;
  }
  const comprimido = await transformar(new Uint8Array(bytes), new CompressionStream("deflate-raw"));
  const pacote = new Uint8Array(comprimido.length + 1);
  pacote[0] = VERSAO_DO_REPLAY;
  pacote.set(comprimido, 1);
  return pacote;
}

export async function desempacotarReplay(pacote: Uint8Array): Promise<Replay> {
  const codigos = CODIGOS_DA_VERSAO[pacote[0]];
  if (!codigos) throw new Error(`Replay de uma versão que este app não conhece (${pacote[0]}).`);
  const bytes = await transformar(pacote.slice(1), new DecompressionStream("deflate-raw"));
  const leitor = { bytes, posicao: 0 };
  const opcoes = bytes[leitor.posicao++];
  const hash = [...bytes.slice(1, 1 + BYTES_DO_HASH)].map((b) => b.toString(16).padStart(2, "0")).join("");
  leitor.posicao = 1 + BYTES_DO_HASH;
  const primeiro = lerVarint(leitor);
  let ticks = primeiro % 2 ? -(primeiro + 1) / 2 : primeiro / 2;
  const quantas = lerVarint(leitor);
  const entradas: EntradaDoReplay[] = [];
  for (let i = 0; i < quantas; i++) {
    const valor = lerVarint(leitor);
    const codigo = valor % codigos;
    ticks += (valor - codigo) / codigos;
    entradas.push(entradaDoCodigo(ticks, codigo));
  }
  return { semFalha: !!(opcoes & 1), fantasma: !!(opcoes & 2), hashDoChart: hash, entradas };
}

export const emTicks = (tempo: number) => Math.round(tempo * TICKS_POR_SEGUNDO);

/**
 * 0 a 4 aperta a pista, 5 a 9 solta, 10 ativa o star power, 11 aperta e 12 solta a nota aberta.
 * O mesmo código vai no replay e na transmissão ao vivo; a aberta entrou no fim para os antigos não mudarem.
 */
export function codigoDaEntrada(e: EntradaDoReplay) {
  if (e.tipo === "estrela") return ESTRELA;
  if (e.pista === PISTA_ABERTA) return e.tipo === "tocar" ? APERTA_A_ABERTA : SOLTA_A_ABERTA;
  return e.tipo === "tocar" ? e.pista : 5 + e.pista;
}

export function entradaDoCodigo(ticks: number, codigo: number): EntradaDoReplay {
  const tempo = ticks / TICKS_POR_SEGUNDO;
  if (codigo === ESTRELA) return { tempo, tipo: "estrela", pista: 0 };
  if (codigo === APERTA_A_ABERTA || codigo === SOLTA_A_ABERTA) return { tempo, tipo: codigo === APERTA_A_ABERTA ? "tocar" : "soltar", pista: PISTA_ABERTA };
  return { tempo, tipo: codigo < 5 ? "tocar" : "soltar", pista: codigo % 5 };
}

/** Varint sem sinal com multiplicação, e não deslocamento: os números passam de 32 bits. */
function escreverVarint(bytes: number[], valor: number) {
  while (valor >= 128) {
    bytes.push((valor % 128) | 128);
    valor = Math.floor(valor / 128);
  }
  bytes.push(valor);
}

function lerVarint(leitor: { bytes: Uint8Array; posicao: number }) {
  let valor = 0;
  let escala = 1;
  for (;;) {
    const byte = leitor.bytes[leitor.posicao++];
    if (byte === undefined) throw new Error("Replay cortado no meio.");
    valor += (byte & 127) * escala;
    if (byte < 128) return valor;
    escala *= 128;
  }
}

async function transformar(bytes: Uint8Array, fluxo: CompressionStream | DecompressionStream) {
  const saida = new Response(bytes as Uint8Array<ArrayBuffer>).body!.pipeThrough(fluxo);
  return new Uint8Array(await new Response(saida).arrayBuffer());
}
