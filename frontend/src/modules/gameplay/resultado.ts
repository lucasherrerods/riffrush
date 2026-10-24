import type { Dificuldade, Instrumento } from "@/modules/songs";
import type { Partida } from "./partida";

export interface Resultado {
  musicaId: string;
  dificuldade: Dificuldade;
  /** Sem ele, a guitarra: o que valia antes dos instrumentos. */
  instrumento?: Instrumento;
  pontos: number;
  acertos: number;
  total: number;
  maiorSequencia: number;
  derrota: boolean;
  /** No multijogador a vida zerou no meio, mas a música foi até o fim. */
  fantasma?: boolean;
}

export function resultadoDaPartida(partida: Partida, musicaId: string, dificuldade: Dificuldade, instrumento: Instrumento = "guitarra"): Resultado {
  return {
    musicaId,
    dificuldade,
    instrumento,
    pontos: Math.round(partida.pontos),
    acertos: partida.acertos,
    total: partida.notas.length,
    maiorSequencia: partida.maiorSequencia,
    derrota: partida.derrota,
    fantasma: partida.fantasma,
  };
}
