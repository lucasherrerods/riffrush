/** Quantos pinos do medidor guardam o star power. */
export const PINOS_DO_STAR_POWER = 3;

/** Quantos pinos estão acesos: cada um acende só quando a sua terça parte do star power enche. */
export function pinosAcesos(estrela: number) {
  // O arredondamento evita que 1/3 * 3 dê 0,999... e deixe o pino apagado.
  const cheios = Math.floor(Math.round(estrela * PINOS_DO_STAR_POWER * 1e6) / 1e6);
  return Math.min(PINOS_DO_STAR_POWER, Math.max(0, cheios));
}
