/* tslint:disable */
/* eslint-disable */
/**
 * Confere se a combinação de mods é válida; devolve a mensagem do problema, ou `undefined`.
 */
export function problemaDosMods(mods: number): string | undefined;
export function modsValemRanking(mods: number): boolean;
export function hashDoBeatmap(bytes: Uint8Array): string;
export function velocidadeDosMods(mods: number): number;
export function multiplicadorDosMods(mods: number): number;
/**
 * O que a biblioteca e a seleção mostram de um `.osu`, sem montar a partida.
 */
export class InfoDoBeatmap {
  free(): void;
  /**
   * Pontos de BPM e de velocidade em trios [tempo, duração da batida (NaN se não muda o BPM), velocidade].
   */
  pontosDeTempo(): Float64Array;
  constructor(texto: string);
  readonly beatmapId: number | undefined;
  /**
   * Duração do mapa em ms, do começo até o fim da última nota.
   */
  readonly duracaoMs: number;
  readonly dificuldade: string;
  readonly notasLongas: number;
  readonly beatmapsetId: number | undefined;
  readonly tituloUnicode: string;
  readonly artistaUnicode: string;
  readonly arquivoDeAudio: string;
  readonly hp: number;
  readonly od: number;
  readonly fundo: string | undefined;
  readonly notas: number;
  readonly mapper: string;
  readonly teclas: number;
  readonly titulo: string;
  readonly artista: string;
  readonly previaMs: number;
}
export class MotorDoMania {
  free(): void;
  /**
   * A nota final pela precisão: "SS", "S", "A", "B", "C" ou "D".
   */
  classificacao(): string;
  totalDeJulgamentos(): number;
  constructor(texto: string, mods: number, semente: number);
  /**
   * As notas em trios [coluna, tempo, fim (-1 se é simples)], já no tempo real e com as colunas dos mods.
   */
  notas(): Int32Array;
  /**
   * Devolve o código do julgamento, ou -1 se o toque não acertou nada.
   */
  tocar(coluna: number, tempo_ms: number): number;
  soltar(coluna: number, tempo_ms: number): number;
  avancar(tempo_ms: number): void;
  /**
   * Os julgamentos desde a última chamada, em grupos de cinco: [nota, coluna, julgamento, ponta (0/1), desvio (NaN sem toque)].
   */
  eventos(): Float64Array;
  /**
   * Janelas no tempo real: [MAX, 300, 200, 100, 50, Miss].
   */
  janelas(): Float64Array;
  /**
   * Quantos de cada julgamento, de MAX a Miss.
   */
  contagem(): Uint32Array;
  precisao(): number;
  terminou(): boolean;
  pontuacao(): number;
  readonly maiorCombo: number;
  readonly vida: number;
  readonly combo: number;
  readonly teclas: number;
  readonly derrota: boolean;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_infodobeatmap_free: (a: number, b: number) => void;
  readonly __wbg_motordomania_free: (a: number, b: number) => void;
  readonly hashDoBeatmap: (a: number, b: number) => [number, number];
  readonly infodobeatmap_arquivoDeAudio: (a: number) => [number, number];
  readonly infodobeatmap_artista: (a: number) => [number, number];
  readonly infodobeatmap_artistaUnicode: (a: number) => [number, number];
  readonly infodobeatmap_beatmapId: (a: number) => [number, number];
  readonly infodobeatmap_beatmapsetId: (a: number) => [number, number];
  readonly infodobeatmap_dificuldade: (a: number) => [number, number];
  readonly infodobeatmap_duracaoMs: (a: number) => number;
  readonly infodobeatmap_fundo: (a: number) => [number, number];
  readonly infodobeatmap_hp: (a: number) => number;
  readonly infodobeatmap_mapper: (a: number) => [number, number];
  readonly infodobeatmap_new: (a: number, b: number) => [number, number, number];
  readonly infodobeatmap_notas: (a: number) => number;
  readonly infodobeatmap_notasLongas: (a: number) => number;
  readonly infodobeatmap_od: (a: number) => number;
  readonly infodobeatmap_pontosDeTempo: (a: number) => [number, number];
  readonly infodobeatmap_previaMs: (a: number) => number;
  readonly infodobeatmap_teclas: (a: number) => number;
  readonly infodobeatmap_titulo: (a: number) => [number, number];
  readonly infodobeatmap_tituloUnicode: (a: number) => [number, number];
  readonly modsValemRanking: (a: number) => number;
  readonly motordomania_avancar: (a: number, b: number) => void;
  readonly motordomania_classificacao: (a: number) => [number, number];
  readonly motordomania_combo: (a: number) => number;
  readonly motordomania_contagem: (a: number) => [number, number];
  readonly motordomania_derrota: (a: number) => number;
  readonly motordomania_eventos: (a: number) => [number, number];
  readonly motordomania_janelas: (a: number) => [number, number];
  readonly motordomania_maiorCombo: (a: number) => number;
  readonly motordomania_new: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly motordomania_notas: (a: number) => [number, number];
  readonly motordomania_pontuacao: (a: number) => number;
  readonly motordomania_precisao: (a: number) => number;
  readonly motordomania_soltar: (a: number, b: number, c: number) => number;
  readonly motordomania_teclas: (a: number) => number;
  readonly motordomania_terminou: (a: number) => number;
  readonly motordomania_tocar: (a: number, b: number, c: number) => number;
  readonly motordomania_totalDeJulgamentos: (a: number) => number;
  readonly motordomania_vida: (a: number) => number;
  readonly multiplicadorDosMods: (a: number) => number;
  readonly problemaDosMods: (a: number) => [number, number];
  readonly velocidadeDosMods: (a: number) => number;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
