/** Quem entrou mutado e tira do mudo ouve a música baixa, não no máximo. */
export const VOLUME_AO_DESMUTAR = 0.3;

export function volumeAoAlternarMudo(volume: number, ultimoAudivel: number) {
  if (volume > 0) return 0;
  return ultimoAudivel > 0 ? ultimoAudivel : VOLUME_AO_DESMUTAR;
}
