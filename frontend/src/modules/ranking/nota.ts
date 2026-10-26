export type Nota = "SS" | "S" | "A" | "B" | "C" | "D";

/** A nota da partida pela precisão (de 0 a 1), com as faixas do osu!mania: SS só com 100%. */
export function notaDaPrecisao(precisao: number): Nota {
  // A precisão vem da API como fração; 100% pode chegar como 0,999999999.
  if (precisao >= 1 - 1e-9) return "SS";
  if (precisao > 0.95) return "S";
  if (precisao > 0.9) return "A";
  if (precisao > 0.8) return "B";
  if (precisao > 0.7) return "C";
  return "D";
}

/** A cor de cada nota, pelos tokens do tema. */
export const COR_DA_NOTA: Record<Nota, string> = {
  SS: "text-texto",
  S: "text-ouro",
  A: "text-sucesso",
  B: "text-estrela",
  C: "text-destaque",
  D: "text-perigo",
};
