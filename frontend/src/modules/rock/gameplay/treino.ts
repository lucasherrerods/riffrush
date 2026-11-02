import type { Nota, Trecho } from "@/modules/rock/songs";

/** As notas que começam no trecho; o sustain que passa do fim é cortado. */
export function notasDoTrecho(notas: Nota[], trecho: Trecho): Nota[] {
  return notas.filter((n) => n.tempo >= trecho.inicio && n.tempo < trecho.fim).map((n) => ({ ...n, duracao: Math.min(n.duracao, trecho.fim - n.tempo) }));
}
