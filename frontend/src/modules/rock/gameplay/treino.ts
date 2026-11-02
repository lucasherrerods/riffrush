import type { Nota, Trecho } from "@/modules/rock/songs";
import { noTempoReal } from "./velocidade";

/** Segundos de música antes do trecho, para as primeiras notas descerem pela pista. */
const PREPARO = 2;
/** Segundos depois do fim do trecho, para julgar a última nota antes de voltar. */
const FOLGA = 0.5;

/** As notas que começam no trecho; o sustain que passa do fim é cortado. */
export function notasDoTrecho(notas: Nota[], trecho: Trecho): Nota[] {
  return notas.filter((n) => n.tempo >= trecho.inicio && n.tempo < trecho.fim).map((n) => ({ ...n, duracao: Math.min(n.duracao, trecho.fim - n.tempo) }));
}

/** De onde a música volta e onde a volta acaba, no tempo real da partida. */
export function limitesDaVolta(trecho: Trecho, velocidade: number, duracaoReal: number) {
  return {
    inicio: noTempoReal(trecho.inicio, velocidade) - PREPARO,
    // Chegar ao fim da música terminaria a partida: o último trecho volta um pouco antes.
    fim: Math.min(noTempoReal(trecho.fim, velocidade) + FOLGA, duracaoReal - FOLGA),
  };
}

export interface Voltas {
  voltas: number;
  /** Precisão da última volta, de 0 a 1. */
  ultima: number | null;
  melhor: number | null;
}

export const VOLTAS_INICIAIS: Voltas = { voltas: 0, ultima: null, melhor: null };

export const registrarVolta = (atual: Voltas, precisao: number): Voltas => ({
  voltas: atual.voltas + 1,
  ultima: precisao,
  melhor: Math.max(atual.melhor ?? 0, precisao),
});
