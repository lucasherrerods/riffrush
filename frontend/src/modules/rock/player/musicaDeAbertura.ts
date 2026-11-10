import type { Musica } from "@/modules/rock/songs";

/**
 * A primeira música do menu: uma das baixadas pela pessoa, sorteada. Sem nenhuma,
 * a primeira da fila, que é a do jogo, livre de direitos autorais.
 */
export function musicaDeAbertura(fila: Musica[], baixadas: Musica[], aleatorio: () => number = Math.random) {
  const ids = new Set(baixadas.map((m) => m.id));
  const candidatas = fila.filter((m) => ids.has(m.id));
  if (candidatas.length === 0) return fila[0];
  return candidatas[Math.floor(aleatorio() * candidatas.length)];
}
