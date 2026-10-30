import type { OpcoesDaPartida } from "./TelaDeJogo";

/** Uma coluna da tela para cada pista, em frações da largura. */
export interface Viewport {
  esquerda: number;
  largura: number;
}

/** As pistas são altas e estreitas: lado a lado aproveitam a tela melhor que empilhadas. */
export const viewportsDaTela = (jogadores: number): Viewport[] => Array.from({ length: jogadores }, (_, i) => ({ esquerda: i / jogadores, largura: 1 / jogadores }));

/** A partir de três pistas ficam só os efeitos leves (raio e pulo) e a pista desenha em resolução menor, para manter os quadros. */
const JOGADORES_PARA_ECONOMIZAR = 3;
const ESCALA_COM_MUITOS_JOGADORES = 0.75;

/** Cada pista a mais custa um desenho inteiro por quadro: a qualidade cai conforme o número de jogadores. */
export function opcoesPeloNumeroDeJogadores(opcoes: OpcoesDaPartida, jogadores: number): OpcoesDaPartida {
  if (jogadores <= 1) return opcoes;
  const economizar = jogadores >= JOGADORES_PARA_ECONOMIZAR;
  return {
    ...opcoes,
    personagem: false,
    soEfeitosLeves: economizar,
    escalaDeRenderizacao: economizar ? Math.min(opcoes.escalaDeRenderizacao, ESCALA_COM_MUITOS_JOGADORES) : opcoes.escalaDeRenderizacao,
  };
}
