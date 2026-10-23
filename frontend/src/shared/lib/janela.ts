/** Os itens visíveis de uma lista sem rolagem: até `tamanho` itens, com o escolhido no meio sempre que possível. */
export function janelaEmVolta(total: number, escolhido: number, tamanho: number) {
  const inicio = Math.max(0, Math.min(escolhido - Math.floor(tamanho / 2), total - tamanho));
  return { inicio, fim: Math.min(total, inicio + tamanho) };
}
