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

/** Ao trocar de mapa, a música entra num ponto sorteado entre 30% e 70% dela. */
export const pontoAleatorioDeInicio = (duracao: number, sorteio = Math.random()) => duracao * (0.3 + 0.4 * sorteio);

/** Onde a música da partida está, em segundos do áudio: com DT, HT ou velocidade mudada, o áudio anda mais rápido ou mais devagar que o relógio. */
export const pontoDaPartida = (inicio: number, agora: number, velocidade: number) => Math.max(0, (agora - inicio) * velocidade);

/** De onde o player continua depois da partida. Se quase não sobrou música, ela recomeça em vez de acabar e pular para a próxima. */
export function pontoDeRetomada(segundos: number, duracao: number) {
  if (segundos < 0 || duracao - segundos < LIMITE_PARA_REINICIAR) return 0;
  return segundos;
}

/** Como a partida acabou: o jogador saiu por conta própria (ou ela terminou) num ponto, ou ele falhou. */
export type SaidaDaPartida = { tipo: "saiu"; segundos: number } | { tipo: "falhou" };

/** Saindo por conta própria, a música continua de onde estava; depois de uma falha, é como entrar pela seleção. */
export const pontoDeVolta = (saida: SaidaDaPartida, duracao: number, sorteio = Math.random()) =>
  saida.tipo === "falhou" ? pontoAleatorioDeInicio(duracao, sorteio) : pontoDeRetomada(saida.segundos, duracao);

/** Uma posição sorteada da fila; sem músicas, nenhuma. */
export const indiceSorteado = (total: number, sorteio = Math.random()) => (total === 0 ? -1 : Math.min(Math.floor(sorteio * total), total - 1));

/** As vizinhas da música atual na fila, as mais perto primeiro, alternando próxima e anterior. */
export function vizinhasParaPreCarregar(tamanho: number, atual: number, raio: number): number[] {
  if (atual < 0 || atual >= tamanho) return [];
  const indices: number[] = [];
  for (let distancia = 1; distancia <= raio; distancia++) {
    for (const passo of [distancia, -distancia]) {
      const indice = indiceVizinho(tamanho, atual, passo);
      if (indice !== atual && !indices.includes(indice)) indices.push(indice);
    }
  }
  return indices;
}
