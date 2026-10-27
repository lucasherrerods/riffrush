/** Os modificadores escolhidos para a partida. Por enquanto, só a velocidade da música. */
export interface Modificadores {
  velocidadeDaMusica: number;
}

/**
 * O nível seguinte da velocidade, dando a volta na lista. Do normal sobe para as rápidas e, depois da
 * mais rápida, passa pelas lentas até voltar ao normal. Fora da lista, recomeça do normal.
 */
export function proximaVelocidade(velocidades: number[], atual: number, passo = 1): number {
  const ordenadas = [...velocidades].sort((a, b) => a - b);
  const posicao = ordenadas.indexOf(atual);
  if (posicao < 0) return 1;
  return ordenadas[(((posicao + passo) % ordenadas.length) + ordenadas.length) % ordenadas.length];
}

/** Quanto os pontos da partida são multiplicados. O motor multiplica pela velocidade da música. */
export const multiplicadorDePontos = ({ velocidadeDaMusica }: Modificadores) => velocidadeDaMusica;
