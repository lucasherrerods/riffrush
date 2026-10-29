/** Onde fica a pista na tela. Tudo em pixels do canvas. */
export interface GeometriaDaPista {
  x: number;
  larguraDaColuna: number;
  teclas: number;
  yDoJulgamento: number;
  altura: number;
}

const LARGURA_MAXIMA_DA_COLUNA = 80;
/** A pista nunca ocupa mais que isso da largura da tela. */
const OCUPACAO_MAXIMA = 0.94;
/** A linha de julgamento fica a 85% da altura, como no mania. */
const POSICAO_DO_JULGAMENTO = 0.85;

export function geometriaDaPista(largura: number, altura: number, teclas: number): GeometriaDaPista {
  const larguraDaColuna = Math.min(LARGURA_MAXIMA_DA_COLUNA, Math.floor((largura * OCUPACAO_MAXIMA) / teclas));
  return {
    x: Math.round((largura - larguraDaColuna * teclas) / 2),
    larguraDaColuna,
    teclas,
    yDoJulgamento: Math.round(altura * POSICAO_DO_JULGAMENTO),
    altura,
  };
}

/** Altura da nota na tela. `rolagemMs` é quanto tempo a nota leva do topo até a linha de julgamento. */
export const yDaNota = (tempoMs: number, agoraMs: number, rolagemMs: number, yDoJulgamento: number) =>
  yDoJulgamento - ((tempoMs - agoraMs) / rolagemMs) * yDoJulgamento;

/**
 * Índices das notas que aparecem agora: as que ainda não passaram do fundo e já entraram pelo topo.
 * `notas` vem do motor em trios [coluna, tempo, fim (-1 se é simples)]; `margemMs` cobre o pedaço abaixo da linha.
 */
export function notasVisiveis(notas: ArrayLike<number>, agoraMs: number, rolagemMs: number, margemMs: number): number[] {
  const visiveis: number[] = [];
  for (let i = 0; i < notas.length / 3; i++) {
    const tempo = notas[i * 3 + 1];
    const fim = notas[i * 3 + 2];
    if (tempo > agoraMs + rolagemMs) break;
    if (Math.max(tempo, fim) >= agoraMs - margemMs) visiveis.push(i);
  }
  return visiveis;
}
