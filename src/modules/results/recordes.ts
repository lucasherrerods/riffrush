import type { Resultado } from "@/modules/gameplay";
import type { Dificuldade } from "@/modules/songs";

export interface Recorde {
  pontos: number;
  estrelas: number;
  fullCombo: boolean;
}

export type Recordes = Record<string, Recorde>;

const CHAVE = "riffrush.recordes";
const FAIXAS_DE_ESTRELAS: [number, number][] = [
  [0.98, 5],
  [0.9, 4],
  [0.75, 3],
  [0.5, 2],
];

export function estrelasDoResultado(resultado: Resultado) {
  if (resultado.derrota || resultado.total === 0) return 0;
  const acerto = resultado.acertos / resultado.total;
  return FAIXAS_DE_ESTRELAS.find(([minimo]) => acerto >= minimo)?.[1] ?? 1;
}

const chaveDoRecorde = (musicaId: string, dificuldade: Dificuldade) => `${musicaId}:${dificuldade}`;

export function carregarRecordes(): Recordes {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? "{}");
  } catch {
    return {};
  }
}

export function recordeDe(recordes: Recordes, musicaId: string, dificuldade: Dificuldade): Recorde | undefined {
  return recordes[chaveDoRecorde(musicaId, dificuldade)];
}

/** Guarda o resultado se ele bater o recorde. Devolve true quando é recorde novo. */
export function salvarRecorde(resultado: Resultado) {
  if (resultado.derrota) return false;
  const recordes = carregarRecordes();
  const chave = chaveDoRecorde(resultado.musicaId, resultado.dificuldade);
  if (recordes[chave] && recordes[chave].pontos >= resultado.pontos) return false;
  recordes[chave] = {
    pontos: resultado.pontos,
    estrelas: estrelasDoResultado(resultado),
    fullCombo: resultado.acertos === resultado.total,
  };
  try {
    localStorage.setItem(CHAVE, JSON.stringify(recordes));
  } catch {
    // Sem armazenamento: o recorde não fica salvo.
  }
  return true;
}
