interface Ambiente {
  modoCompetitivo: boolean;
  efeitos: boolean;
  personagem: boolean;
  comWebGL: boolean;
  estreita: boolean;
}

/** O que aparece em volta da pista. A pista e o placar aparecem sempre. */
export interface CenaDaPartida {
  /** O palco 3D, com a banda e o público. */
  palco: boolean;
  /** O personagem do jogador, no palco ou no HUD. */
  personagem: boolean;
  /** O clipe da música, quando ela tem vídeo. */
  video: boolean;
}

export function cenaDaPartida({ modoCompetitivo, efeitos, personagem, comWebGL, estreita }: Ambiente): CenaDaPartida {
  // O clipe fica no canto, fora da pista, e o jogador escolheu baixá-lo: continua mesmo no modo competitivo.
  if (modoCompetitivo) return { palco: false, personagem: false, video: true };
  // No celular a GPU fica toda para a pista, sem palco nem personagem; sem efeitos, o palco também sai.
  return { palco: comWebGL && !estreita && efeitos, personagem: personagem && !estreita, video: true };
}
