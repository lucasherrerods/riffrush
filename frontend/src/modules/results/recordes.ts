import { estrelasPorPontos, type Resultado } from "@/modules/gameplay";
import type { Dificuldade, Instrumento } from "@/modules/songs";

export interface Recorde {
  pontos: number;
  estrelas: number;
  fullCombo: boolean;
}

export type Recordes = Record<string, Recorde>;

const CHAVE = "riffrush.recordes";
/** A mesma escala da barra da partida. Quem termina a música sem derrota leva pelo menos 1 estrela. */
export function estrelasDoResultado(resultado: Pick<Resultado, "derrota" | "total" | "pontos">) {
  if (resultado.derrota || resultado.total === 0) return 0;
  return Math.max(1, estrelasPorPontos(resultado.pontos, resultado.total));
}

/** A guitarra fica com a chave de antes dos instrumentos, para os recordes antigos continuarem valendo. */
const chaveDoRecorde = (musicaId: string, dificuldade: Dificuldade, instrumento: Instrumento = "guitarra") =>
  instrumento === "guitarra" ? `${musicaId}:${dificuldade}` : `${musicaId}:${instrumento}:${dificuldade}`;

export function carregarRecordes(): Recordes {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? "{}");
  } catch {
    return {};
  }
}

export function recordeDe(recordes: Recordes, musicaId: string, dificuldade: Dificuldade, instrumento?: Instrumento): Recorde | undefined {
  return recordes[chaveDoRecorde(musicaId, dificuldade, instrumento)];
}

/** Guarda o resultado se ele bater o recorde. Devolve true quando é recorde novo. */
export function salvarRecorde(resultado: Resultado) {
  // Fantasma conta no placar da sala, mas não é recorde: no solo a mesma partida teria acabado.
  if (resultado.derrota || resultado.fantasma) return false;
  const recordes = carregarRecordes();
  const chave = chaveDoRecorde(resultado.musicaId, resultado.dificuldade, resultado.instrumento);
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
