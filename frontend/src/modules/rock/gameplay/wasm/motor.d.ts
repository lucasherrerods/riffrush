/* tslint:disable */
/* eslint-disable */
/**
 * O tempo arredondado para a grade da partida (1 ms).
 */
export function quantizar(tempo: number): number;
/**
 * 0 é perfeito, 1 ótimo e 2 bom.
 */
export function julgar(distancia: number): number;
/**
 * As velocidades da música que o jogo oferece.
 */
export function velocidades(): Float64Array;
export function janela_de_acerto(): number;
export class MotorDaPartida {
  free(): void;
  /**
   * O que mudou desde a última chamada, na ordem:
   * - 19 números do estado: tempo (NaN antes de começar), pontos, sequência, maior sequência, acertos,
   *   perfeitos, ótimos, bons, valor dos acertos, erros, vida, ticks de star power, barra de star power (0 a 1),
   *   star power ativo, derrota, fantasma, a primeira nota que ainda importa, o multiplicador e a precisão;
   * - quantas notas mudaram e, para cada uma, índice, bandeiras e até onde o sustain rendeu;
   * - quantos eventos e, para cada um, código e dois valores;
   * - quantas frases falharam e cada uma.
   */
  sincronizar(): Float64Array;
  multiplicador(): number;
  ativar_estrela(): boolean;
  /**
   * Tempo e duração de cada nota já no tempo real (dividido pela velocidade) e na grade da partida,
   * e a pista em que ela de fato cai (sem a aberta, a aberta vira verde), para o espelho começar igual.
   */
  grade_das_notas(): Float64Array;
  /**
   * As notas vêm em quatro listas paralelas, que passam para o WASM sem um objeto por nota.
   */
  constructor(tempos: Float64Array, pistas: Uint8Array, frases: Int32Array, duracoes: Float64Array, sem_falha: boolean, fantasma: boolean, velocidade: number, sem_aberta: boolean, jeito: number, pune_toque_em_vazio: boolean);
  tocar(pista: number, tempo: number): boolean;
  soltar(pista: number, tempo: number): void;
  acertar(indice: number, tempo: number): void;
  avancar(tempo: number): void;
  palhetar(tempo: number): boolean;
  precisao(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_motordapartida_free: (a: number, b: number) => void;
  readonly janela_de_acerto: () => number;
  readonly julgar: (a: number) => number;
  readonly motordapartida_acertar: (a: number, b: number, c: number) => void;
  readonly motordapartida_ativar_estrela: (a: number) => number;
  readonly motordapartida_avancar: (a: number, b: number) => void;
  readonly motordapartida_grade_das_notas: (a: number) => [number, number];
  readonly motordapartida_multiplicador: (a: number) => number;
  readonly motordapartida_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => number;
  readonly motordapartida_palhetar: (a: number, b: number) => number;
  readonly motordapartida_precisao: (a: number) => number;
  readonly motordapartida_sincronizar: (a: number) => [number, number];
  readonly motordapartida_soltar: (a: number, b: number, c: number) => void;
  readonly motordapartida_tocar: (a: number, b: number, c: number) => number;
  readonly quantizar: (a: number) => number;
  readonly velocidades: () => [number, number];
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
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
