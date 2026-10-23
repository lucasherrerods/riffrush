import { PONTOS_POR_NOTA } from "./partida";

/**
 * Quantas vezes a pontuação base da música (50 por nota, sem multiplicador) cada estrela pede.
 * Como no Clone Hero, multiplicador alto e star power levam às últimas estrelas.
 */
export const FAIXAS_DAS_ESTRELAS = [0.25, 0.5, 1, 2, 2.8];
export const MAXIMO_DE_ESTRELAS = FAIXAS_DAS_ESTRELAS.length;

/**
 * De 0 a 5, contínuo: a parte inteira são as estrelas conquistadas e a fração, o caminho até a próxima.
 * Cada estrela ocupa o mesmo espaço na barra, mesmo com faixas de tamanhos diferentes.
 */
export function progressoDasEstrelas(pontos: number, totalDeNotas: number) {
  if (totalDeNotas <= 0 || pontos <= 0) return 0;
  const vezes = pontos / (totalDeNotas * PONTOS_POR_NOTA);
  const proxima = FAIXAS_DAS_ESTRELAS.findIndex((faixa) => vezes < faixa);
  if (proxima === -1) return MAXIMO_DE_ESTRELAS;
  const inicio = proxima === 0 ? 0 : FAIXAS_DAS_ESTRELAS[proxima - 1];
  return proxima + (vezes - inicio) / (FAIXAS_DAS_ESTRELAS[proxima] - inicio);
}

export const estrelasPorPontos = (pontos: number, totalDeNotas: number) => Math.floor(progressoDasEstrelas(pontos, totalDeNotas));
