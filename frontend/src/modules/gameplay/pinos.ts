/** Quantos pinos do medidor guardam o star power. */
export const PINOS_DO_STAR_POWER = 4;

/** Quantos pinos estão acesos: cada um acende só quando o seu quarto do star power enche. */
export function pinosAcesos(estrela: number) {
  // O arredondamento evita que uma conta como 0,1 + 0,15 fique em 0,2499... e deixe o pino apagado.
  const cheios = Math.floor(Math.round(estrela * PINOS_DO_STAR_POWER * 1e6) / 1e6);
  return Math.min(PINOS_DO_STAR_POWER, Math.max(0, cheios));
}

/** A partir do segundo pino o star power já pode ser usado, e os pinos acesos brilham para chamar a atenção. */
export function comDestaque(estrela: number) {
  return pinosAcesos(estrela) >= 2;
}
