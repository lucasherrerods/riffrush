/** Largura sobre altura das highways do Clone Hero (512x1024). */
export const PROPORCAO_DA_HIGHWAY = 0.5;
const ALTURA_MINIMA = 64;

export interface Recorte {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

const limitar = (valor: number, minimo: number, maximo: number) => Math.min(Math.max(valor, minimo), maximo);

/** O maior pedaço de proporção 1:2 que cabe na imagem, no meio dela. */
export function recorteInicial(largura: number, altura: number): Recorte {
  const alturaDoRecorte = Math.min(altura, largura / PROPORCAO_DA_HIGHWAY);
  const larguraDoRecorte = alturaDoRecorte * PROPORCAO_DA_HIGHWAY;
  return { x: (largura - larguraDoRecorte) / 2, y: (altura - alturaDoRecorte) / 2, largura: larguraDoRecorte, altura: alturaDoRecorte };
}

/** Arrasta o recorte sem deixar ele sair da imagem. */
export function moverRecorte(recorte: Recorte, dx: number, dy: number, largura: number, altura: number): Recorte {
  return {
    ...recorte,
    x: limitar(recorte.x + dx, 0, largura - recorte.largura),
    y: limitar(recorte.y + dy, 0, altura - recorte.altura),
  };
}

/** Aumenta ou diminui o recorte em volta do centro, mantendo a proporção e dentro da imagem. */
export function redimensionarRecorte(recorte: Recorte, fator: number, largura: number, altura: number): Recorte {
  const maxima = recorteInicial(largura, altura).altura;
  const novaAltura = limitar(recorte.altura * fator, Math.min(ALTURA_MINIMA, maxima), maxima);
  const novaLargura = novaAltura * PROPORCAO_DA_HIGHWAY;
  const centroX = recorte.x + recorte.largura / 2;
  const centroY = recorte.y + recorte.altura / 2;
  const centrado = { x: centroX - novaLargura / 2, y: centroY - novaAltura / 2, largura: novaLargura, altura: novaAltura };
  return moverRecorte(centrado, 0, 0, largura, altura);
}
