export const PISTAS = 5;

export interface Nota {
  tempo: number;
  pista: number;
}

export interface NotaNaTela extends Nota {
  indice: number;
  /** 0 no topo da pista, 1 em cima do alvo. */
  posicao: number;
}

const BATIDA = 60000 / 140;
/** Um riff de 4 compassos em colcheias; -1 é pausa. Começa simples e sobe para o laranja. */
const RIFF = [
  0, -1, 0, 1, 2, -1, 1, 0,
  0, -1, 0, 1, 2, 3, 2, 1,
  2, -1, 2, 3, 4, -1, 3, 2,
  1, 2, 3, 4, 3, 2, 1, 0,
];

export function notasDoRiff(duracao: number, inicio = 1200): Nota[] {
  const notas: Nota[] = [];
  for (let passo = 0; ; passo++) {
    const tempo = inicio + passo * (BATIDA / 2);
    if (tempo >= duracao) return notas;
    const pista = RIFF[passo % RIFF.length];
    if (pista >= 0) notas.push({ tempo, pista });
  }
}

export function notasNaTela(notas: Nota[], agora: number, antecedencia: number, acertadas: Set<number> = new Set()): NotaNaTela[] {
  const visiveis: NotaNaTela[] = [];
  notas.forEach((nota, indice) => {
    if (acertadas.has(indice)) return;
    const posicao = 1 - (nota.tempo - agora) / antecedencia;
    if (posicao >= 0 && posicao <= 1.15) visiveis.push({ ...nota, indice, posicao });
  });
  return visiveis;
}
