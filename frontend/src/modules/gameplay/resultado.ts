import type { Dificuldade, Instrumento } from "@/modules/songs";
import { VALOR_DO_JULGAMENTO, type Julgamento, type Partida } from "./partida";

export interface Resultado {
  musicaId: string;
  dificuldade: Dificuldade;
  /** Sem ele, a guitarra: o que valia antes dos instrumentos. */
  instrumento?: Instrumento;
  pontos: number;
  acertos: number;
  total: number;
  /** Partidas antigas, vindas do ranking, não têm. */
  julgamentos?: Record<Julgamento, number>;
  /** De 0 a 1, pelo valor de cada nota do chart. Sem ela, vale acertos sobre o total. */
  precisao?: number;
  maiorSequencia: number;
  derrota: boolean;
  /** No multijogador a vida zerou no meio, mas a música foi até o fim. */
  fantasma?: boolean;
}

/** Soma do valor de cada acerto pelo julgamento: a base da precisão do jogo, que a API também guarda. */
export function valorDosAcertos(julgamentos: Record<Julgamento, number>) {
  return (Object.keys(julgamentos) as Julgamento[]).reduce((soma, j) => soma + julgamentos[j] * VALOR_DO_JULGAMENTO[j], 0);
}

export function resultadoDaPartida(partida: Partida, musicaId: string, dificuldade: Dificuldade, instrumento: Instrumento = "guitarra"): Resultado {
  return {
    musicaId,
    dificuldade,
    instrumento,
    pontos: Math.round(partida.pontos),
    acertos: partida.acertos,
    total: partida.notas.length,
    julgamentos: { ...partida.julgamentos },
    precisao: partida.notas.length ? partida.valorDosAcertos / (partida.notas.length * VALOR_DO_JULGAMENTO.perfeito) : 0,
    maiorSequencia: partida.maiorSequencia,
    derrota: partida.derrota,
    fantasma: partida.fantasma,
  };
}

