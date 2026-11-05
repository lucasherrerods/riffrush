import { PONTOS_POR_NOTA } from "./partida";

/**
 * Quanto da pontuação base cada estrela pede, como no YARG (que copia o Clone Hero e o Rock Band): a base é uma partida
 * perfeita, com o multiplicador subindo normalmente e sem star power. Com o star power, dá para passar das 5 estrelas,
 * mas a tela para nelas.
 */
export const FAIXAS_DAS_ESTRELAS = [0.06, 0.12, 0.2, 0.47, 0.78];
export const MAXIMO_DE_ESTRELAS = FAIXAS_DAS_ESTRELAS.length;

/** A pontuação de quem acerta `totalDeNotas` notas seguidas: o multiplicador sobe a cada 10, até 4x. Sem sustains e sem solo. */
export function pontuacaoBase(totalDeNotas: number) {
  let pontos = 0;
  for (let sequencia = 1; sequencia <= totalDeNotas; sequencia++) pontos += PONTOS_POR_NOTA * Math.min(1 + Math.floor(sequencia / 10), 4);
  return pontos;
}

/**
 * De 0 a 5, contínuo: a parte inteira são as estrelas conquistadas e a fração, o caminho até a próxima.
 * Cada estrela ocupa o mesmo espaço na barra, mesmo com faixas de tamanhos diferentes.
 */
export function progressoDasEstrelas(pontos: number, totalDeNotas: number) {
  if (totalDeNotas <= 0 || pontos <= 0) return 0;
  const vezes = pontos / pontuacaoBase(totalDeNotas);
  const proxima = FAIXAS_DAS_ESTRELAS.findIndex((faixa) => vezes < faixa);
  if (proxima === -1) return MAXIMO_DE_ESTRELAS;
  const inicio = proxima === 0 ? 0 : FAIXAS_DAS_ESTRELAS[proxima - 1];
  return proxima + (vezes - inicio) / (FAIXAS_DAS_ESTRELAS[proxima] - inicio);
}

export const estrelasPorPontos = (pontos: number, totalDeNotas: number) => Math.floor(progressoDasEstrelas(pontos, totalDeNotas));
