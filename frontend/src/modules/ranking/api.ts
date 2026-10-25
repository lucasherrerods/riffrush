import type { Dificuldade, Instrumento } from "@/modules/songs";
import { URL_DA_API, criarCliente } from "@/shared/lib/api";

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

/** Um jogador no ranking geral, ordenado pelo XP total. */
export interface PosicaoNoGeral {
  posicao: number;
  nome: string;
  avatar: string | null;
  xp_total: number;
  nivel: { nivel: number; xp_no_nivel: number; xp_para_o_proximo: number };
}

export interface RespostaDoRanking<P = PosicaoNoRanking> {
  jogadores: number;
  top: P[];
  /** A linha de quem está logado, mesmo fora do top. */
  meu: P | null;
}

export type RespostaDoGeral = RespostaDoRanking<PosicaoNoGeral>;

/** Uma música no ranking das mais jogadas, somando todos os jogadores. */
export interface MusicaNoRanking {
  posicao: number;
  musica_id: string;
  partidas: number;
  /** Quantos jogadores diferentes tocaram. */
  jogadores: number;
}

function conferirMusicas(corpo: unknown): MusicaNoRanking[] {
  if (!Array.isArray(corpo)) throw new Error("As músicas mais jogadas vieram num formato inesperado.");
  return corpo;
}

/** Uma resposta estranha (proxy, versão antiga da API) vira erro aqui, e não uma tela quebrada no painel. */
function conferirRanking<P>(corpo: unknown): RespostaDoRanking<P> {
  const ranking = corpo as Partial<RespostaDoRanking<P>> | null;
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
      chamar<unknown>("GET", `/ranking?${new URLSearchParams({ musica_id: musicaId, dificuldade, instrumento })}`, { token, sinal }).then(conferirRanking<PosicaoNoRanking>),
    geral: ({ token, sinal }: { token?: string; sinal?: AbortSignal } = {}) =>
      chamar<unknown>("GET", "/ranking/geral", { token, sinal }).then(conferirRanking<PosicaoNoGeral>),
    musicas: ({ sinal }: { sinal?: AbortSignal } = {}) => chamar<unknown>("GET", "/ranking/musicas", { sinal }).then(conferirMusicas),
  };
}

export type ApiDoRanking = ReturnType<typeof criarApiDoRanking>;

export const apiDoRanking = criarApiDoRanking(URL_DA_API);
