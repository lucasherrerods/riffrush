import type { Musica } from "./tipos";

const MENOR_PENTATONICA = [0, 3, 5, 7, 10];
const MENOR = [0, 2, 3, 5, 7, 8, 10];
const MAIOR_PENTATONICA = [0, 2, 4, 7, 9];
const DORICA = [0, 2, 3, 5, 7, 9, 10];

/** Músicas originais, compostas e sintetizadas na hora a partir da semente. */
export const MUSICAS_EMBUTIDAS: Musica[] = [
  {
    id: "neon-highway",
    titulo: "Neon Highway",
    artista: "The Synthwave Riders",
    genero: "Synthwave",
    bpm: 118,
    capa: ["#ec4899", "#6366f1"],
    intensidade: 1,
    semente: 11,
    estilo: { bpm: 118, tonica: 57, escala: MENOR, progressao: [0, 5, 2, 6], timbre: "sawtooth", distorcao: 0, densidade: 0.35 },
  },
  {
    id: "por-do-sol",
    titulo: "Pôr do Sol em Copacabana",
    artista: "Banda Maresia",
    genero: "Pop Rock",
    bpm: 126,
    capa: ["#f59e0b", "#ef4444"],
    intensidade: 2,
    semente: 27,
    estilo: { bpm: 126, tonica: 55, escala: MAIOR_PENTATONICA, progressao: [0, 3, 4, 3], timbre: "triangle", distorcao: 0.2, densidade: 0.45 },
  },
  {
    id: "cosmic-riff",
    titulo: "Cosmic Riff",
    artista: "Orbital Dogs",
    genero: "Space Rock",
    bpm: 138,
    capa: ["#06b6d4", "#8b5cf6"],
    intensidade: 3,
    semente: 42,
    estilo: { bpm: 138, tonica: 52, escala: DORICA, progressao: [0, 3, 0, 6], timbre: "square", distorcao: 0.4, densidade: 0.55 },
  },
  {
    id: "overdrive",
    titulo: "Overdrive",
    artista: "Asfalto Quente",
    genero: "Hard Rock",
    bpm: 152,
    capa: ["#dc2626", "#1a1722"],
    intensidade: 4,
    semente: 77,
    estilo: { bpm: 152, tonica: 52, escala: MENOR_PENTATONICA, progressao: [0, 3, 2, 1], timbre: "sawtooth", distorcao: 0.7, densidade: 0.65 },
  },
  {
    id: "furia-de-aco",
    titulo: "Fúria de Aço",
    artista: "Martelo Negro",
    genero: "Metal",
    bpm: 172,
    capa: ["#71717a", "#7f1d1d"],
    intensidade: 5,
    semente: 99,
    estilo: { bpm: 172, tonica: 50, escala: MENOR, progressao: [0, 5, 6, 4], timbre: "sawtooth", distorcao: 0.9, densidade: 0.75 },
  },
];
