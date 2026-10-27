import { TEMA_PADRAO, type Tema } from "./temas";

export { TEMAS, TEMA_PADRAO, type Tema } from "./temas";

const canais = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** Brilho no modelo HSB (0 a 1). */
export function brilho(hex: string) {
  return Math.max(...canais(hex));
}

/** Quanto a cor se afasta do cinza (0 a 1). */
export function croma(hex: string) {
  const c = canais(hex);
  return Math.max(...c) - Math.min(...c);
}

/** Cor hex com transparência, para o canvas, que não lê variáveis CSS. */
export function comAlfa(hex: string, alfa: number) {
  const [r, g, b] = canais(hex).map((c) => Math.round(c * 255));
  return `rgba(${r},${g},${b},${Math.max(0, alfa)})`;
}

const paraVariavel = (nome: string) => `--cor-${nome.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`)}`;

export function aplicarTokens(raiz: HTMLElement, tema: Tema = TEMA_PADRAO) {
  for (const [nome, valor] of Object.entries(tema.cores)) raiz.style.setProperty(paraVariavel(nome), valor);
}
