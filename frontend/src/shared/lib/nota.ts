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

export interface EstiloDaNota {
  /** De 0 (D) a 1 (SS): quanto o emblema se destaca. */
  intensidade: number;
  /** Tamanho relativo ao da linha de texto. */
  escala: number;
  /** Aro laranja em volta da letra. */
  aro: boolean;
  /** Brilho de fogo atrás do aro. */
  brilho: boolean;
}

const ORDEM: Nota[] = ["D", "C", "B", "A", "S", "SS"];

/** O emblema cresce e ganha aro e brilho conforme a nota sobe, no estilo de Devil May Cry. */
export function estiloDaNota(nota: Nota): EstiloDaNota {
  const nivel = ORDEM.indexOf(nota);
  return { intensidade: nivel / (ORDEM.length - 1), escala: 1 + nivel * 0.06, aro: nivel >= 2, brilho: nivel >= 4 };
}
