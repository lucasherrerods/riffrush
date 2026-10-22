/** Escala das notas no horizonte, comparada com a linha de batida. */
const ESCALA_NO_HORIZONTE = 0.22;
const LARGURA_MAXIMA = 620;

export interface LayoutDaPista {
  centro: number;
  linhaDeBatida: number;
  horizonte: number;
  largura: number;
  larguraDoTraste: number;
}

/** Medidas da pista na tela. As áreas de toque do celular usam as mesmas contas. */
export function layoutDaPista(largura: number, altura: number): LayoutDaPista {
  const estreita = largura < 768;
  const larguraDaPista = estreita ? largura * 0.94 : Math.min(largura * 0.52, LARGURA_MAXIMA);
  return {
    centro: largura / 2,
    linhaDeBatida: altura * (estreita ? 0.8 : 0.86),
    horizonte: altura * (estreita ? 0.16 : 0.08),
    largura: larguraDaPista,
    larguraDoTraste: larguraDaPista / 5,
  };
}

/** Perspectiva: `distancia` 0 é a linha de batida e 1 é o horizonte. */
export function projetar(layout: LayoutDaPista, distancia: number) {
  const escala = 1 / (1 + distancia * (1 / ESCALA_NO_HORIZONTE - 1));
  const y = layout.linhaDeBatida - ((layout.linhaDeBatida - layout.horizonte) * (1 - escala)) / (1 - ESCALA_NO_HORIZONTE);
  return { y, escala };
}

export function xDaPista(layout: LayoutDaPista, pista: number, escala: number) {
  return layout.centro + (pista - 2) * layout.larguraDoTraste * escala;
}
