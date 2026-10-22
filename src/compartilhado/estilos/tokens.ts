/** Cores com brilhos distintos para não disputarem atenção (design.md, regra 4). */
export const paleta = {
  primaria: "#a21caf",
  sucesso: "#22c55e",
  perigo: "#dc2626",
  destaque: "#fb923c",
};

/** Neutros frios e levemente tingidos; quanto mais elevada a superfície, mais clara. */
export const cores = {
  fundo: "#121117",
  superficie: "#1b1a21",
  superficieElevada: "#252430",
  borda: "#34333f",
  texto: "#f3f2f7",
  textoSuave: "#aaa8b4",
  ...paleta,
};

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

const paraVariavel = (nome: string) => `--cor-${nome.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`)}`;

export function aplicarTokens(raiz: HTMLElement) {
  for (const [nome, valor] of Object.entries(cores)) raiz.style.setProperty(paraVariavel(nome), valor);
}
