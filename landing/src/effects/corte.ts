/** O mesmo desenho do `.corte` da identidade, com o tamanho da quina variando. */
export function poligonoDoCorte(tamanho: number) {
  const px = `${Math.max(0, Math.round(tamanho))}px`;
  return `polygon(${px} 0, 100% 0, 100% calc(100% - ${px}), calc(100% - ${px}) 100%, 0 100%, 0 ${px})`;
}
