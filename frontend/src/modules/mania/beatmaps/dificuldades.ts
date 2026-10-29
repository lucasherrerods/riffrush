export type FaixaDeDificuldade = "Easy" | "Normal" | "Hard" | "Insane" | "Expert" | "Expert+";

/** A faixa de dificuldade do osu! pelas estrelas: é ela que dá a cor do ícone da dificuldade. */
export function faixaDasEstrelas(estrelas: number): FaixaDeDificuldade {
  if (estrelas < 2) return "Easy";
  if (estrelas < 2.7) return "Normal";
  if (estrelas < 4) return "Hard";
  if (estrelas < 5.3) return "Insane";
  if (estrelas < 6.5) return "Expert";
  return "Expert+";
}
