/** Duração da entrada (o menu some), do giro e da saída (o disco revela o novo modo). */
export const ENTRADA_MS = 150;
export const DURACAO_DO_GIRO_MS = 1150;
export const SAIDA_MS = 200;

/** A curva do giro: arranca devagar, corre no meio e assenta, como um disco de papel girado à mão. */
export const CURVA_DO_GIRO = "cubic-bezier(0.65, 0, 0.35, 1)";

/** Uma folga para a borda do disco não aparecer nos cantos. */
const FOLGA = 24;

/**
 * O disco gira em volta do meio da borda de baixo da tela. A tela inteira cabe na metade
 * de cima dele; a metade de baixo, de ponta-cabeça, guarda o outro modo até o giro trazê-lo.
 */
export function geometriaDaVolvelle(largura: number, altura: number) {
  const raio = Math.ceil(Math.hypot(largura / 2, altura)) + FOLGA;
  return {
    raio,
    eixo: { x: largura / 2, y: altura },
    cena: { esquerda: raio - largura / 2, topo: raio - altura, largura, altura },
  };
}
