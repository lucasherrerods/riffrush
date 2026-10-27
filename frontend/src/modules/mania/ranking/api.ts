import { URL_DA_API, criarCliente } from "@/shared/lib/api";

export interface PosicaoNoRankingDoMania {
  posicao: number;
  partida_id: string;
  conta_id: string;
  nome: string;
  avatar: string | null;
  pontuacao: number;
  precisao: number;
  maior_combo: number;
  mods: number;
  jogada_em: string;
}

export function criarApiDoRanking(base = URL_DA_API, buscar?: typeof fetch) {
  const chamar = criarCliente(base, buscar);
  return {
    /** O top 10 da dificuldade, um lugar por jogador. */
    ranking: (beatmapId: number, sinal?: AbortSignal) =>
      chamar<{ linhas: PosicaoNoRankingDoMania[] }>("GET", `/mania/ranking/${beatmapId}`, { sinal }).then((r) => r.linhas),
  };
}

export const apiDoRanking = criarApiDoRanking();
