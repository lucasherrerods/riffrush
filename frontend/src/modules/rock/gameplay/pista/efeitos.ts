/** Efeitos de jogo da pista, em funções puras: o desenho fica em desenhar.ts. */

import { cores } from "@/modules/rock/tema";
import type { Julgamento } from "../partida";

/** Quanto tempo o julgamento do último acerto fica escrito acima da nota. */
export const DURACAO_DO_JULGAMENTO = 0.45;

/** Texto e cor de cada julgamento, nas mesmas cores da precisão no HUD: verde, ouro e apagado. */
export function estiloDoJulgamento(julgamento: Julgamento) {
  if (julgamento === "perfeito") return { texto: "PERFEITO", cor: cores.sucesso };
  if (julgamento === "otimo") return { texto: "ÓTIMO", cor: cores.ouro };
  return { texto: "BOM", cor: cores.textoSuave };
}

/** Combos que trovejam: 25, 50, 100 e depois a cada 50. Quanto maior, mais raios. */
export function forcaDoTrovao(sequencia: number) {
  if (sequencia === 25) return 1;
  if (sequencia === 50) return 2;
  if (sequencia >= 100 && sequencia % 50 === 0) return 3;
  return 0;
}

export interface Ponto {
  x: number;
  y: number;
}

/** Gerador pseudoaleatório com semente (mulberry32): o mesmo raio em todos os quadros da sua vida. */
function aleatorioComSemente(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Raio em zigue-zague do início ao fim, desviando até `desvio` pixels para os lados. */
export function pontosDoRaio(semente: number, inicio: Ponto, fim: Ponto, segmentos: number, desvio: number): Ponto[] {
  const aleatorio = aleatorioComSemente(semente);
  return Array.from({ length: segmentos + 1 }, (_, i) => {
    const t = i / segmentos;
    const lado = i === 0 || i === segmentos ? 0 : (aleatorio() * 2 - 1) * desvio;
    return { x: inicio.x + (fim.x - inicio.x) * t + lado, y: inicio.y + (fim.y - inicio.y) * t };
  });
}

const DURACAO_DO_TREMOR = 0.6;
const FORCA_DO_TREMOR = 9;

/** Deslocamento da pista ao soltar o star power: forte no começo, sumindo em 0,6 s. */
export function tremor(desdeAtivacao: number) {
  if (desdeAtivacao < 0 || desdeAtivacao >= DURACAO_DO_TREMOR) return { x: 0, y: 0, angulo: 0 };
  const forca = FORCA_DO_TREMOR * (1 - desdeAtivacao / DURACAO_DO_TREMOR) ** 2;
  return {
    x: Math.sin(desdeAtivacao * 97) * forca,
    y: Math.cos(desdeAtivacao * 83) * forca * 0.6,
    angulo: Math.sin(desdeAtivacao * 71) * forca * 0.002,
  };
}

const DURACAO_DO_PULO = 0.3;
const ALTURA_DO_PULO = 10;

/** Deslocamento vertical da pista ao soltar o star power: sobe e volta numa meia senoide em 0,3 s. */
export function pulo(desdeAtivacao: number) {
  if (desdeAtivacao <= 0 || desdeAtivacao >= DURACAO_DO_PULO) return 0;
  return -Math.sin((desdeAtivacao / DURACAO_DO_PULO) * Math.PI) * ALTURA_DO_PULO;
}

const NOTAS_POR_NIVEL = 10;
const MULTIPLICADOR_MAXIMO = 4;

/** Quanto falta para o próximo multiplicador (0 a 1); 1 quando já está no máximo. */
export function progressoDoMultiplicador(sequencia: number) {
  if (sequencia >= NOTAS_POR_NIVEL * (MULTIPLICADOR_MAXIMO - 1)) return 1;
  return (sequencia % NOTAS_POR_NIVEL) / NOTAS_POR_NIVEL;
}
