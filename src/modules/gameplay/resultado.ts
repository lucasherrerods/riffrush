import type { Dificuldade } from "@/modules/songs";
import type { Partida } from "./partida";

export interface Resultado {
  musicaId: string;
  dificuldade: Dificuldade;
  pontos: number;
  acertos: number;
  total: number;
  maiorSequencia: number;
  derrota: boolean;
  /** No multijogador a vida zerou no meio, mas a música foi até o fim. */
  fantasma?: boolean;
}

export function resultadoDaPartida(partida: Partida, musicaId: string, dificuldade: Dificuldade): Resultado {
  return {
    musicaId,
    dificuldade,
    pontos: Math.round(partida.pontos),
    acertos: partida.acertos,
    total: partida.notas.length,
    maiorSequencia: partida.maiorSequencia,
    derrota: partida.derrota,
    fantasma: partida.fantasma,
  };
}
