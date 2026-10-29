import { ehTelaEstreita } from "@/shared/hooks/useTelaEstreita";

/** Inclinação da pista quando o jogador não escolheu outra: deitada, como no Guitar Hero. */
export const INCLINACAO_PADRAO = 6;
const INCLINACAO_MAXIMA = 10;
const LARGURA_MAXIMA = 620;

export interface LayoutDaPista {
  centro: number;
  linhaDeBatida: number;
  horizonte: number;
  largura: number;
  larguraDoTraste: number;
  /** Escala das notas no horizonte, comparada com a linha de batida. */
  escalaNoHorizonte: number;
}

/** Vai de `emPe` (inclinação 0) a `deitada` (inclinação máxima). */
const entre = (emPe: number, deitada: number, t: number) => emPe + (deitada - emPe) * t;

/** Medidas da pista na tela. As áreas de toque do celular usam as mesmas contas. */
export function layoutDaPista(largura: number, altura: number, inclinacao = INCLINACAO_PADRAO): LayoutDaPista {
  const estreita = ehTelaEstreita(largura);
  const t = Math.min(Math.max(inclinacao, 0), INCLINACAO_MAXIMA) / INCLINACAO_MAXIMA;
  const larguraDaPista = estreita ? largura * 0.94 : Math.min(largura * 0.52, LARGURA_MAXIMA);
  return {
    centro: largura / 2,
    // Deitada, a pista desce até mais perto da borda para não ficar baixa; no celular a linha não sai do lugar por causa dos botões de toque.
    linhaDeBatida: altura * (estreita ? 0.8 : entre(0.86, 0.9, t)),
    // O braço acaba antes do topo da tela e some num fade; quanto mais deitado, mais baixo o fim.
    horizonte: altura * entre(estreita ? 0.2 : 0.16, 0.3, t),
    largura: larguraDaPista,
    larguraDoTraste: larguraDaPista / 5,
    escalaNoHorizonte: entre(0.22, 0.4, t),
  };
}

/** Perspectiva: `distancia` 0 é a linha de batida e 1 é o horizonte. */
export function projetar(layout: LayoutDaPista, distancia: number) {
  const { escalaNoHorizonte } = layout;
  const escala = 1 / (1 + distancia * (1 / escalaNoHorizonte - 1));
  const y = layout.linhaDeBatida - ((layout.linhaDeBatida - layout.horizonte) * (1 - escala)) / (1 - escalaNoHorizonte);
  return { y, escala };
}

export function xDaPista(layout: LayoutDaPista, pista: number, escala: number) {
  return layout.centro + (pista - 2) * layout.larguraDoTraste * escala;
}

/** Grossura das cordas na linha de batida, da mais grave (esquerda) para a mais aguda. */
const ESPESSURA_DAS_CORDAS = [0.11, 0.095, 0.08, 0.06, 0.048];
/** Todas as cordas têm o fio enrolado por fora: lisas, as finas pareciam linhas soltas no braço. */
const CORDAS_ENROLADAS = 5;

/** As cordas passam no meio de cada pista, da linha de batida (ou um pouco antes) até o fim do braço. */
export function cordasDaPista(layout: LayoutDaPista, inicio: number) {
  const perto = projetar(layout, inicio);
  const longe = projetar(layout, 1);
  return ESPESSURA_DAS_CORDAS.map((espessura, pista) => ({
    pista,
    enrolada: pista < CORDAS_ENROLADAS,
    perto: { x: xDaPista(layout, pista, perto.escala), y: perto.y },
    longe: { x: xDaPista(layout, pista, longe.escala), y: longe.y },
    espessura: layout.larguraDoTraste * espessura,
    escalaDoFim: longe.escala / perto.escala,
  }));
}
