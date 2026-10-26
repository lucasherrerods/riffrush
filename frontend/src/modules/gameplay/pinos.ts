/** Quantos pinos do medidor guardam o star power. */
export const PINOS_DO_STAR_POWER = 4;

/** De 0 (apagado) a 1 (aceso) para cada pino: cada um é um quarto do star power, enchendo da esquerda para a direita. */
export function brilhoDosPinos(estrela: number) {
  return Array.from({ length: PINOS_DO_STAR_POWER }, (_, i) => Math.min(1, Math.max(0, estrela * PINOS_DO_STAR_POWER - i)));
}
