import { semAcento } from "@/shared/lib/busca";
import type { MusicaNoRanking } from "./api";

export type OrdemDasMusicas = "partidas" | "jogadores" | "recorde" | "nome";

export const ORDENS_DAS_MUSICAS: { id: OrdemDasMusicas; rotulo: string }[] = [
  { id: "partidas", rotulo: "Mais partidas" },
  { id: "jogadores", rotulo: "Mais jogadores" },
  { id: "recorde", rotulo: "Maior precisão do recorde" },
  { id: "nome", rotulo: "Nome (A–Z)" },
];

export interface FiltroDasMusicas {
  busca: string;
  ordem: OrdemDasMusicas;
}

/** A lista de músicas do leaderboard depois da busca e da ordem escolhidas. A API já manda por mais partidas. */
export function filtrarMusicas(musicas: MusicaNoRanking[], { busca, ordem }: FiltroDasMusicas, nome: (m: MusicaNoRanking) => string) {
  const procurado = semAcento(busca);
  const achadas = procurado ? musicas.filter((m) => semAcento(nome(m)).includes(procurado)) : [...musicas];
  if (ordem === "jogadores") return achadas.sort((a, b) => b.jogadores - a.jogadores || b.partidas - a.partidas);
  if (ordem === "recorde") return achadas.sort((a, b) => (b.recorde?.precisao ?? -1) - (a.recorde?.precisao ?? -1));
  if (ordem === "nome") return achadas.sort((a, b) => semAcento(nome(a)).localeCompare(semAcento(nome(b))));
  return achadas;
}
