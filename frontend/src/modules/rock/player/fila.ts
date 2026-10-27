/** Até aqui, voltar reinicia a música; depois disso, vai para a anterior. Igual aos players comuns. */
export const LIMITE_PARA_REINICIAR = 3;

export function indiceVizinho(total: number, atual: number, passos: number) {
  if (total === 0) return -1;
  return (((atual + passos) % total) + total) % total;
}

export const acaoDeVoltar = (posicao: number): "reiniciar" | "anterior" => (posicao > LIMITE_PARA_REINICIAR ? "reiniciar" : "anterior");

/** Onde a música está agora, em segundos, sem passar do fim. */
export function posicaoNaMusica(tocando: boolean, deslocamento: number, inicio: number, agora: number, duracao: number) {
  const posicao = tocando ? agora - inicio : deslocamento;
  return Math.min(Math.max(posicao, 0), duracao);
}

export function formatarTempo(segundos: number) {
  const inteiros = Math.floor(segundos);
  return `${Math.floor(inteiros / 60)}:${String(inteiros % 60).padStart(2, "0")}`;
}
