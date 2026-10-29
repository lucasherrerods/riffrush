/** Quantos pinos do medidor guardam o star power. */
export const PINOS_DO_STAR_POWER = 4;

const entre0e1 = (valor: number) => Math.min(1, Math.max(0, valor));

/** De 0 (vazio) a 1 (cheio) para cada pino: cada um é um quarto do star power, enchendo da esquerda para a direita. */
export function progressoDosPinos(estrela: number) {
  return Array.from({ length: PINOS_DO_STAR_POWER }, (_, i) => entre0e1(estrela * PINOS_DO_STAR_POWER - i));
}

interface Ponto {
  x: number;
  y: number;
}

/** O vidro de um pino: topo esquerdo, topo direito, base direita e base esquerda. */
export type Vidro = readonly [Ponto, Ponto, Ponto, Ponto];

/**
 * Os pontos (formato do `points` do SVG) do líquido dentro do vidro: ele sobe da base pelas
 * duas laterais, então acompanha a inclinação e a perspectiva de cada pino.
 */
export function nivelDoLiquido([topoEsquerdo, topoDireito, baseDireita, baseEsquerda]: Vidro, progresso: number) {
  const p = entre0e1(progresso);
  const subir = (base: Ponto, topo: Ponto) => ({ x: base.x + (topo.x - base.x) * p, y: base.y + (topo.y - base.y) * p });
  return [subir(baseEsquerda, topoEsquerdo), subir(baseDireita, topoDireito), baseDireita, baseEsquerda].map(({ x, y }) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(" ");
}

/** A partir do segundo pino cheio o star power já pode ser usado, e o azul de todos pulsa para chamar a atenção. */
export function pinosPulsando(progressos: readonly number[]) {
  return progressos.filter((progresso) => progresso >= 1).length >= 2;
}

/** O star power pode ser solto com dois pinos cheios, a mesma regra do pulso do medidor; já ativo, não. */
export function especialUtilizavel(estrela: number, ativo: boolean) {
  return !ativo && pinosPulsando(progressoDosPinos(estrela));
}
