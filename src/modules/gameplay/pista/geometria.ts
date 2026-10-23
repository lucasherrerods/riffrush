import { ehTelaEstreita } from "@/shared/hooks/useTelaEstreita";

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
  const estreita = ehTelaEstreita(largura);
  const larguraDaPista = estreita ? largura * 0.94 : Math.min(largura * 0.52, LARGURA_MAXIMA);
  return {
    centro: largura / 2,
    linhaDeBatida: altura * (estreita ? 0.8 : 0.86),
    // O braço acaba antes do topo da tela e some num fade, como no Guitar Hero.
    horizonte: altura * (estreita ? 0.2 : 0.16),
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

/** Grossura das cordas na linha de batida, da mais grave (esquerda) para a mais aguda. */
const ESPESSURA_DAS_CORDAS = [0.11, 0.095, 0.08, 0.06, 0.048];
/** Como numa guitarra, as cordas mais grossas têm um fio enrolado por fora. */
const CORDAS_ENROLADAS = 3;

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
