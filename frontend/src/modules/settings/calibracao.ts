export const BATIDAS_DA_CALIBRACAO = 16;
export const INTERVALO_DA_CALIBRACAO = 0.5;
/** As primeiras batidas servem para a pessoa pegar o ritmo e não entram na conta. */
const BATIDAS_DE_AQUECIMENTO = 4;
const TOQUES_MINIMOS = 4;
const ATRASO_MAXIMO_MS = 200;

export function batidasDaCalibracao(inicio: number, quantidade = BATIDAS_DA_CALIBRACAO, intervalo = INTERVALO_DA_CALIBRACAO) {
  return Array.from({ length: quantidade }, (_, i) => inicio + i * intervalo);
}

/**
 * Compara cada toque com a batida mais próxima e devolve a mediana das diferenças, em ms.
 * Devolve null quando não há toques suficientes para confiar na medida.
 */
export function medirAtraso(batidas: number[], toques: number[]) {
  const intervalo = batidas[1] - batidas[0];
  const diferencas: number[] = [];
  for (const toque of toques) {
    const indice = batidas.reduce((melhor, batida, i) => (Math.abs(batida - toque) < Math.abs(batidas[melhor] - toque) ? i : melhor), 0);
    const diferenca = toque - batidas[indice];
    if (indice >= BATIDAS_DE_AQUECIMENTO && Math.abs(diferenca) < intervalo / 2) diferencas.push(diferenca);
  }
  if (diferencas.length < TOQUES_MINIMOS) return null;
  diferencas.sort((a, b) => a - b);
  const mediana = diferencas[Math.floor(diferencas.length / 2)];
  const arredondado = Math.round((mediana * 1000) / 5) * 5;
  return Math.max(-ATRASO_MAXIMO_MS, Math.min(ATRASO_MAXIMO_MS, arredondado));
}
