export const BATIDAS_DA_CALIBRACAO = 16;
export const INTERVALO_DA_CALIBRACAO = 0.5;
/** As primeiras batidas servem para a pessoa pegar o ritmo e não entram na conta. */
const BATIDAS_DE_AQUECIMENTO = 4;
const TOQUES_MINIMOS = 4;
const ATRASO_MAXIMO_MS = 200;

export function batidasDaCalibracao(inicio: number, quantidade = BATIDAS_DA_CALIBRACAO, intervalo = INTERVALO_DA_CALIBRACAO) {
  return Array.from({ length: quantidade }, (_, i) => inicio + i * intervalo);
}

/** Fase média dos toques dentro do intervalo, entre -intervalo/2 e +intervalo/2. Média circular: -240 e +260 ms são a mesma fase. */
function centroDosToques(batidas: number[], toques: number[], intervalo: number) {
  let x = 0;
  let y = 0;
  for (const toque of toques) {
    const angulo = (2 * Math.PI * (toque - batidas[0])) / intervalo;
    x += Math.cos(angulo);
    y += Math.sin(angulo);
  }
  return (Math.atan2(y, x) / (2 * Math.PI)) * intervalo;
}

/**
 * Casa cada toque com a batida em volta do centro dos toques e devolve a mediana das diferenças, em ms.
 * Pela batida mais próxima, um atraso perto de meio intervalo jogava parte dos toques na batida vizinha e a medida virava o extremo oposto.
 * Devolve null quando não há toques suficientes para confiar na medida.
 */
export function medirAtraso(batidas: number[], toques: number[]) {
  const intervalo = batidas[1] - batidas[0];
  const centro = centroDosToques(batidas, toques, intervalo);
  const diferencas: number[] = [];
  for (const toque of toques) {
    const indice = Math.round((toque - centro - batidas[0]) / intervalo);
    if (indice >= BATIDAS_DE_AQUECIMENTO && indice < batidas.length) diferencas.push(toque - batidas[indice]);
  }
  if (diferencas.length < TOQUES_MINIMOS) return null;
  diferencas.sort((a, b) => a - b);
  const mediana = diferencas[Math.floor(diferencas.length / 2)];
  const arredondado = Math.round((mediana * 1000) / 5) * 5;
  return Math.max(-ATRASO_MAXIMO_MS, Math.min(ATRASO_MAXIMO_MS, arredondado));
}
