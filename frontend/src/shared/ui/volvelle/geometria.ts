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

/** A curva do giro como função, para o que anda quadro a quadro junto com o disco: o mesmo `cubic-bezier(0.65, 0, 0.35, 1)`. */
export function curvaDoGiro(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const bezier = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s ** 2 * (1 - s) + s ** 3;
  // Acha o ponto da curva em x = t por bissecção (em x ela só cresce) e devolve o y dele.
  let [baixo, alto] = [0, 1];
  for (let i = 0; i < 30; i++) {
    const meio = (baixo + alto) / 2;
    if (bezier(0.65, 0.35, meio) < t) baixo = meio;
    else alto = meio;
  }
  return bezier(0, 1, (baixo + alto) / 2);
}

/**
 * O pedaço da tela que a metade de cima do disco cobre quando ele girou `graus` no sentido do relógio:
 * o semiplano acima da linha que passa pelo eixo. Em 0 é a tela inteira; em meia volta, nada.
 */
export function semiplanoDaCapa(eixo: { x: number; y: number }, alcance: number, graus: number) {
  const rad = (graus * Math.PI) / 180;
  const [cos, sen] = [Math.cos(rad), Math.sin(rad)];
  const pontos = [
    [alcance, 0],
    [alcance, -alcance],
    [-alcance, -alcance],
    [-alcance, 0],
  ].map(([x, y]) => `${(eixo.x + x * cos - y * sen).toFixed(1)}px ${(eixo.y + x * sen + y * cos).toFixed(1)}px`);
  return `polygon(${pontos.join(", ")})`;
}
