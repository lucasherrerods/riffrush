/** Medida de CSS feita de uma parte relativa ao container e uma parte fixa. */
export interface Medida {
  porcento: number;
  px: number;
}

const arredondar = (valor: number) => Math.round(valor * 1000) / 1000;

/** Medida no meio do caminho entre duas, para animar largura e posição sem pular. */
export function medidaEntre(de: Medida, ate: Medida, progresso: number) {
  const t = Math.min(1, Math.max(0, progresso));
  const porcento = arredondar(de.porcento + (ate.porcento - de.porcento) * t);
  const px = arredondar(de.px + (ate.px - de.px) * t);
  return `calc(${porcento}% + ${px}px)`;
}

/** Largura de uma coluna numa grade de `total` colunas separadas por `espaco` px. */
export function colunaDaGrade(total: number, espaco: number): Medida {
  return { porcento: 100 / total, px: -(espaco * (total - 1)) / total };
}

/** Onde começa a coluna `indice`: as colunas anteriores e os espaços entre elas. */
export function posicaoNaGrade(indice: number, total: number, espaco: number): Medida {
  return { porcento: (100 * indice) / total, px: (espaco * indice) / total };
}
