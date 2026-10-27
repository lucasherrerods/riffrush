import type { EntradaDoMania } from "./TelaDeJogoMania";

/*
 * O replay do Mania, no formato que o motor lê (backend/motor-mania/src/replay.rs): o primeiro byte é a versão,
 * e o resto é deflate cru de mods, semente, md5 do .osu e as entradas com o intervalo para a anterior.
 */
export const VERSAO_DO_REPLAY_DO_MANIA = 1;

export interface ReplayDoMania {
  mods: number;
  semente: number;
  hash: string;
  entradas: EntradaDoMania[];
}

function escreverVarint(bytes: number[], valor: number) {
  while (valor >= 0x80) {
    bytes.push((valor % 0x80) | 0x80);
    valor = Math.floor(valor / 0x80);
  }
  bytes.push(valor);
}

/** Inteiros negativos viram positivos pequenos: -1 vira 1, 1 vira 2. */
const zigzag = (valor: number) => (valor >= 0 ? valor * 2 : -valor * 2 - 1);

export async function empacotarReplayDoMania({ mods, semente, hash, entradas }: ReplayDoMania): Promise<Uint8Array> {
  const corpo: number[] = [];
  const u32 = (valor: number) => corpo.push(valor & 0xff, (valor >>> 8) & 0xff, (valor >>> 16) & 0xff, (valor >>> 24) & 0xff);
  u32(mods >>> 0);
  u32(semente >>> 0);
  for (let i = 0; i < 16; i++) corpo.push(parseInt(hash.slice(i * 2, i * 2 + 2), 16) || 0);
  escreverVarint(corpo, entradas.length);
  let anterior = 0;
  for (const [tempo, coluna, toca] of entradas) {
    escreverVarint(corpo, zigzag(tempo - anterior));
    anterior = tempo;
    corpo.push((coluna << 1) | toca);
  }
  const fluxo = new Response(new Uint8Array(corpo)).body!.pipeThrough(new CompressionStream("deflate-raw"));
  const comprimido = new Uint8Array(await new Response(fluxo).arrayBuffer());
  const pacote = new Uint8Array(comprimido.length + 1);
  pacote[0] = VERSAO_DO_REPLAY_DO_MANIA;
  pacote.set(comprimido, 1);
  return pacote;
}
