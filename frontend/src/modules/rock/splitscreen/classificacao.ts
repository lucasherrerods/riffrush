import type { Resultado } from "@/modules/rock/gameplay";

export interface ResultadoDoJogador {
  nome: string;
  resultado: Resultado;
}

/** Mais pontos vence; empatados dividem a posição, como num pódio. */
export function classificar(resultados: ResultadoDoJogador[]) {
  const ordenados = [...resultados].sort((a, b) => b.resultado.pontos - a.resultado.pontos);
  return ordenados.map((linha) => ({ ...linha, posicao: 1 + ordenados.filter((outro) => outro.resultado.pontos > linha.resultado.pontos).length }));
}
