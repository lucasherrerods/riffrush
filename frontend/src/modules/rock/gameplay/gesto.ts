interface Ponto {
  x: number;
  y: number;
}

/** Quantos px o dedo precisa subir para o arraste soltar o star power. */
const SUBIDA_MINIMA = 60;

/** No celular, arrastar o dedo para cima em qualquer lugar da tela solta o star power. */
export function ehArrasteParaCima(inicio: Ponto, fim: Ponto) {
  const subida = inicio.y - fim.y;
  return subida >= SUBIDA_MINIMA && subida > Math.abs(fim.x - inicio.x);
}
