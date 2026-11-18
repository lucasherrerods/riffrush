/** A posição de cada pontuação, na ordem recebida: mais pontos na frente, e empatados dividem a posição, como num pódio. */
export function posicoesPorPontos(pontos: number[]): number[] {
  return pontos.map((p) => 1 + pontos.filter((outro) => outro > p).length);
}
