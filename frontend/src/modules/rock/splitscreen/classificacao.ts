import { posicoesPorPontos, type Resultado } from "@/modules/rock/gameplay";

export interface ResultadoDoJogador {
  nome: string;
  resultado: Resultado;
}

/** Mais pontos vence; empatados dividem a posição, como num pódio. */
export function classificar(resultados: ResultadoDoJogador[]) {
  const ordenados = [...resultados].sort((a, b) => b.resultado.pontos - a.resultado.pontos);
  const posicoes = posicoesPorPontos(ordenados.map((l) => l.resultado.pontos));
  return ordenados.map((linha, i) => ({ ...linha, posicao: posicoes[i] }));
}
