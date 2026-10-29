/** Medidas do carrossel em px, na escala de 8 do design. */
export const ALTURA_DA_MUSICA = 80;
export const ALTURA_DA_DIFICULDADE = 48;
export const ESPACO = 8;
/** Raio da roda imaginária em que as músicas giram: quanto menor, mais curvo. */
export const RAIO_DA_CURVA = 1200;
/** Quanto a roda do mouse precisa girar para andar uma música (um "clique" comum vale 100). */
const GIRO_POR_MUSICA = 100;

/**
 * Distância do topo de cada música até o topo da selecionada.
 * As dificuldades abertas embaixo da selecionada empurram as músicas de baixo.
 */
export function posicoesNoCarrossel(quantidade: number, selecionada: number, dificuldadesAbertas: number) {
  const passo = ALTURA_DA_MUSICA + ESPACO;
  const aberto = dificuldadesAbertas * (ALTURA_DA_DIFICULDADE + ESPACO);
  return Array.from({ length: quantidade }, (_, i) => (i - selecionada) * passo + (i > selecionada ? aberto : 0));
}

/** O meio do grupo aberto (a selecionada e suas dificuldades), medido do topo da selecionada. É ele que fica no centro da tela. */
export const centroDoGrupoAberto = (dificuldadesAbertas: number) => (ALTURA_DA_MUSICA + dificuldadesAbertas * (ALTURA_DA_DIFICULDADE + ESPACO)) / 2;

/** Quanto a música vai para a direita por estar longe do centro, seguindo a borda de uma roda (como no osu!). */
export function recuoNaCurva(distancia: number) {
  const d = Math.min(Math.abs(distancia), RAIO_DA_CURVA);
  return RAIO_DA_CURVA - Math.sqrt(RAIO_DA_CURVA ** 2 - d ** 2);
}

/** Transforma o giro acumulado da roda do mouse em músicas a andar, guardando o que sobrou. */
export function passosDaRoda(acumulado: number) {
  const passos = Math.trunc(acumulado / GIRO_POR_MUSICA);
  return { passos, resto: acumulado - passos * GIRO_POR_MUSICA };
}

/** Arraste do dedo (em px, para cima positivo) em músicas a andar: uma música por altura de música arrastada. */
export function passosDoArraste(acumulado: number) {
  const passos = Math.trunc(acumulado / ALTURA_DA_MUSICA);
  return { passos, resto: acumulado - passos * ALTURA_DA_MUSICA };
}
