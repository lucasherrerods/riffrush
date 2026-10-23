import shine from "./audio/spektrem-shine.mp3";
import type { Musica } from "./tipos";

/**
 * Músicas que vêm com o jogo. O chart é gerado do áudio, como numa música importada.
 * "Shine" do Spektrem é um lançamento NoCopyrightSounds (NCS): uso livre com crédito ao artista.
 */
export const MUSICAS_EMBUTIDAS: Musica[] = [
  {
    id: "spektrem-shine",
    titulo: "Shine",
    artista: "Spektrem",
    genero: "Electro House",
    bpm: 128,
    capa: ["#22d3ee", "#7c3aed"],
    intensidade: 3,
    audioEmbutido: shine,
  },
];
