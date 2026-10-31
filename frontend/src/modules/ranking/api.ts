import type { JeitoDeJogar } from "@/modules/rock/gameplay";
import type { Dificuldade, Instrumento } from "@/modules/rock/songs";
import { URL_DA_API, criarCliente } from "@/shared/lib/api";

/** Como a API devolve, em snake_case. */
export interface PosicaoNoRanking {
  posicao: number;
  nome: string;
  avatar: string | null;
  pontos: number;
  acertos: number;
  total: number;
  /** De 0 a 1, pelo valor de cada nota. Aparece na linha; quem ordena são os pontos. */
  precisao: number;
  maior_sequencia: number | null;
  jogada_em: string;
  /** A partida do recorde, para abrir as estatísticas dela. */
  partida_id: string;
}

/** Uma partida aberta pelo ranking: o que a tela de resultado mostra. */
export interface PartidaDoRanking {
  id: string;
  nome: string;
  avatar: string | null;
  musica_id: string;
  dificuldade: Dificuldade;
  instrumento: Instrumento;
  pontos: number;
  acertos: number;
  total: number;
  /** Só as partidas que o servidor conferiu têm. */
  precisao: number | null;
  /** Partidas antigas não têm. */
  maior_sequencia: number | null;
  derrota: boolean;
  fantasma: boolean;
  jogada_em: string;
  /** Se dá para assistir ao replay. */
  tem_replay: boolean;
  /** Só as partidas que o servidor conferiu têm. */
  jeito_de_jogar?: JeitoDeJogar | null;
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
  /** Do Encore ou do nome do arquivo. Sem eles, vale o nome da biblioteca. */
  titulo?: string | null;
  artista?: string | null;
  /** Endereço da imagem da capa. */
  capa?: string | null;
  /** O primeiro lugar pelos pontos na dificuldade mais alta. Sem ele, ninguém terminou uma partida conferida pelo servidor. */
  recorde?: { nome: string; pontos: number; precisao: number; dificuldade: Dificuldade; jeito_de_jogar?: JeitoDeJogar | null } | null;
}

/** O que ordena o ranking de uma música. */
export type OrdemDoRanking = "precisao" | "pontos";

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
      { instrumento = "guitarra", jeito = "gamepad", ordem = "pontos", token, sinal }: { instrumento?: Instrumento; jeito?: JeitoDeJogar; ordem?: OrdemDoRanking; token?: string; sinal?: AbortSignal } = {},
    ) => {
      // Os pontos são o padrão da API: o pedido só leva a ordem quando ela muda.
      const parametros = new URLSearchParams({ musica_id: musicaId, dificuldade, instrumento, jeito_de_jogar: jeito, ...(ordem === "precisao" && { ordem }) });
      return chamar<unknown>("GET", `/ranking?${parametros}`, { token, sinal }).then(conferirRanking<PosicaoNoRanking>);
    },
    geral: ({ token, sinal }: { token?: string; sinal?: AbortSignal } = {}) =>
      chamar<unknown>("GET", "/ranking/geral", { token, sinal }).then(conferirRanking<PosicaoNoGeral>),
    partida: (id: string, { sinal }: { sinal?: AbortSignal } = {}) =>
      chamar<PartidaDoRanking>("GET", `/partidas/${encodeURIComponent(id)}`, { sinal }),
    replay: (id: string) => chamar<Uint8Array>("GET", `/partidas/${encodeURIComponent(id)}/replay`, { bytes: true }),
    musicas: ({ sinal }: { sinal?: AbortSignal } = {}) => chamar<unknown>("GET", "/ranking/musicas", { sinal }).then(conferirMusicas),
  };
}

export type ApiDoRanking = ReturnType<typeof criarApiDoRanking>;

export const apiDoRanking = criarApiDoRanking(URL_DA_API);
