import type { Dificuldade } from "@/modules/songs";
import { criarCliente } from "@/shared/lib/api";

/** Como a API devolve, em snake_case. */
export interface PosicaoNoRanking {
  posicao: number;
  nome: string;
  avatar: string | null;
  pontos: number;
  acertos: number;
  total: number;
  jogada_em: string;
}

export interface RespostaDoRanking {
  jogadores: number;
  top: PosicaoNoRanking[];
  /** O recorde de quem está logado, mesmo fora do top. */
  meu: PosicaoNoRanking | null;
}

export function criarApiDoRanking(base: string, buscar?: typeof fetch) {
  const chamar = criarCliente(base, buscar);
  return {
    buscar: (musicaId: string, dificuldade: Dificuldade, { token, sinal }: { token?: string; sinal?: AbortSignal } = {}) =>
      chamar<RespostaDoRanking>("GET", `/ranking?${new URLSearchParams({ musica_id: musicaId, dificuldade })}`, { token, sinal }),
  };
}

export type ApiDoRanking = ReturnType<typeof criarApiDoRanking>;
