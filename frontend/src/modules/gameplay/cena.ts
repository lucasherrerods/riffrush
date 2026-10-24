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
  if (modoCompetitivo) return { palco: false, personagem: false, video: false };
  // No celular a GPU fica toda para a pista; sem efeitos, o palco também sai.
  return { palco: comWebGL && !estreita && efeitos, personagem, video: true };
}
