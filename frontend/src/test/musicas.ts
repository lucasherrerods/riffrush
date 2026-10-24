import type { Musica } from "@/modules/songs";

/**
 * Músicas de mentira para os testes de tela, que precisam de uma lista com várias.
 * O catálogo de verdade tem uma música só e o áudio dela vem de um arquivo.
 */
export const MUSICAS_DE_TESTE: Musica[] = [
  { id: "neon-highway", titulo: "Neon Highway", artista: "The Synthwave Riders", genero: "Synthwave", bpm: 118, capa: ["#ec4899", "#6366f1"], intensidade: 1 },
  { id: "por-do-sol", titulo: "Pôr do Sol em Copacabana", artista: "Banda Maresia", genero: "Pop Rock", bpm: 126, capa: ["#f59e0b", "#ef4444"], intensidade: 2 },
  { id: "cosmic-riff", titulo: "Cosmic Riff", artista: "Orbital Dogs", genero: "Space Rock", bpm: 138, capa: ["#06b6d4", "#8b5cf6"], intensidade: 3 },
  { id: "overdrive", titulo: "Overdrive", artista: "Asfalto Quente", genero: "Hard Rock", bpm: 152, capa: ["#dc2626", "#1a1722"], intensidade: 4 },
  { id: "furia-de-aco", titulo: "Fúria de Aço", artista: "Martelo Negro", genero: "Metal", bpm: 172, capa: ["#71717a", "#7f1d1d"], intensidade: 5 },
];
