import type { Dificuldade, Instrumento } from "@/modules/songs";
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

/** Uma resposta estranha (proxy, versão antiga da API) vira erro aqui, e não uma tela quebrada no painel. */
function conferirRanking(corpo: unknown): RespostaDoRanking {
  const ranking = corpo as Partial<RespostaDoRanking> | null;
  if (!ranking || typeof ranking !== "object" || !Array.isArray(ranking.top) || typeof ranking.jogadores !== "number") {
    throw new Error("O ranking veio num formato inesperado.");
  }
  return { jogadores: ranking.jogadores, top: ranking.top, meu: ranking.meu ?? null };
}

export function criarApiDoRanking(base: string, buscar?: typeof fetch) {
  const chamar = criarCliente(base, buscar);
  return {
    buscar: (
      musicaId: string,
      dificuldade: Dificuldade,
      { instrumento = "guitarra", token, sinal }: { instrumento?: Instrumento; token?: string; sinal?: AbortSignal } = {},
    ) =>
      chamar<unknown>("GET", `/ranking?${new URLSearchParams({ musica_id: musicaId, dificuldade, instrumento })}`, { token, sinal }).then(conferirRanking),
  };
}

export type ApiDoRanking = ReturnType<typeof criarApiDoRanking>;
