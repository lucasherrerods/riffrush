import { pontosDoRaio } from "./pista/efeitos";

/** Os tempos da entrada na música, em segundos desde o começo. */
export const ENTRADA = {
  /** O clarão e o estrondo. */
  clarao: 0.12,
  /** As faixas varrem a tela na diagonal. */
  varrida: 0.55,
  /** O nome da música entra com um tranco. */
  nome: 0.45,
  /** As faixas abrem para a partida. */
  saida: 1.75,
  total: 2.2,
};

/**
 * O raio da entrada, de cima a baixo da tela, num viewBox de 0 a 100.
 * Os galhos saem de pontos do raio principal e descem para os lados.
 */
export function raioDaEntrada(semente: number) {
  const principal = pontosDoRaio(semente, { x: 58, y: -4 }, { x: 42, y: 104 }, 14, 9);
  const galhos = [3, 6, 9].map((i, n) => {
    const de = principal[i];
    const lado = n % 2 ? 1 : -1;
    return pontosDoRaio(semente + 11 * (n + 1), de, { x: de.x + lado * 18, y: de.y + 22 }, 5, 4);
  });
  return { principal, galhos };
}

export const emCaminho = (pontos: { x: number; y: number }[]) => pontos.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
