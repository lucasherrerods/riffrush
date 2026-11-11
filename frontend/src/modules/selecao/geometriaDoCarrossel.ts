/** Medidas do carrossel em px, na escala de 8 do design. */
export const ALTURA_DA_MUSICA = 80;
export const ALTURA_DA_DIFICULDADE = 48;
export const ESPACO = 8;
/** Raio da roda imaginária em que as músicas giram: quanto menor, mais curvo. */
export const RAIO_DA_CURVA = 1200;

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

/**
 * O ponto do grupo aberto que fica no centro da tela. Cabendo, é o meio dele.
 * Se não cabe, começa mostrando o topo e desce só o necessário para a dificuldade escolhida aparecer.
 */
export function centroDoGrupoNaTela(dificuldadesAbertas: number, escolhida: number, alturaVisivel: number) {
  const meio = centroDoGrupoAberto(dificuldadesAbertas);
  const altura = meio * 2;
  if (alturaVisivel <= 0 || altura <= alturaVisivel) return meio;
  const fimDaEscolhida = escolhida >= 0 ? ALTURA_DA_MUSICA + ESPACO + escolhida * (ALTURA_DA_DIFICULDADE + ESPACO) + ALTURA_DA_DIFICULDADE + ESPACO : 0;
  return Math.min(Math.max(alturaVisivel / 2, fimDaEscolhida - alturaVisivel / 2), altura - alturaVisivel / 2);
}

/** Quanto a música vai para a direita por estar longe do centro, seguindo a borda de uma roda (como no osu!). */
export function recuoNaCurva(distancia: number) {
  const d = Math.min(Math.abs(distancia), RAIO_DA_CURVA);
  return RAIO_DA_CURVA - Math.sqrt(RAIO_DA_CURVA ** 2 - d ** 2);
}

/** Até onde a lista pode ser arrastada: a primeira música, ou a última música ou dificuldade aberta, no centro da tela. */
export function limitesDoDeslocamento(posicoes: number[], centro: number, dificuldadesAbertas = 0) {
  if (!posicoes.length) return { min: 0, max: 0 };
  const meioDa = (p: number) => p + ALTURA_DA_MUSICA / 2 - centro;
  // A selecionada fica no zero; a última dificuldade dela termina no fim do grupo aberto.
  const ultimaDificuldade = dificuldadesAbertas ? centroDoGrupoAberto(dificuldadesAbertas) * 2 - ALTURA_DA_DIFICULDADE / 2 - centro : 0;
  return { min: Math.min(0, meioDa(posicoes[0])), max: Math.max(0, meioDa(posicoes[posicoes.length - 1]), ultimaDificuldade) };
}

export const limitar = (valor: number, { min, max }: { min: number; max: number }) => Math.min(Math.max(valor, min), max);

/** Em quantos ms a inércia perde ~63% da velocidade depois de soltar o arraste. */
const FREIO_DA_INERCIA = 325;
/** Abaixo disso (px/ms) a lista já parou. */
export const VELOCIDADE_PARADA = 0.02;

/** Um quadro da inércia: quanto a lista anda em `ms` e a velocidade que sobra, freando como numa rolagem de celular. */
export function passoDaInercia(velocidade: number, ms: number) {
  const restante = velocidade * Math.exp(-ms / FREIO_DA_INERCIA);
  const andou = (velocidade - restante) * FREIO_DA_INERCIA;
  return { andou, velocidade: Math.abs(restante) < VELOCIDADE_PARADA ? 0 : restante };
}

/** O índice depois de andar pela roda: passa da última para a primeira e vice-versa, como o teclado e a roda do mouse fazem. */
export function indiceDandoAVolta(indice: number, passos: number, quantidade: number) {
  if (quantidade <= 0) return 0;
  return (((indice + passos) % quantidade) + quantidade) % quantidade;
}

/** Limita os passos para o arraste parar na primeira e na última música, sem dar a volta. */
export function passosSemDarAVolta(indice: number, passos: number, quantidade: number) {
  return Math.min(Math.max(indice + passos, 0), quantidade - 1) - indice;
}
