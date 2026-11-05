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

/** Uma dificuldade no leaderboard dos mapas mais jogados. */
export interface MapaMaisJogado {
  posicao: number;
  beatmap_id: number;
  beatmapset_id: number | null;
  partidas: number;
  jogadores: number;
  /** Do .osu que o servidor guardou; sem ele, vale o nome da biblioteca. */
  titulo: string | null;
  artista: string | null;
  dificuldade: string | null;
  recorde: { nome: string; pontuacao: number; precisao: number } | null;
}

/** Os números do Mania no perfil, só das partidas que entram no ranking. */
export interface EstatisticasDoMania {
  partidas: number;
  mapas: number;
  precisao_media: number;
  maior_combo: number;
  pontuacao_total: number;
  ss: number;
  s: number;
  no_top: number;
  /** De MAX a Miss. */
  contagem: [number, number, number, number, number, number];
}

export function criarApiDoRanking(base = URL_DA_API, buscar?: typeof fetch) {
  const chamar = criarCliente(base, buscar);
  return {
    /** O top 10 da dificuldade, um lugar por jogador. */
    ranking: (beatmapId: number, sinal?: AbortSignal) =>
      chamar<{ linhas: PosicaoNoRankingDoMania[] }>("GET", `/mania/ranking/${beatmapId}`, { sinal }).then((r) => r.linhas),
    /** O replay de uma partida do top 10; quem caiu do top não tem mais o dele. */
    replay: (partidaId: string) => chamar<Uint8Array>("GET", `/mania/partidas/${encodeURIComponent(partidaId)}/replay`, { bytes: true }),
    mapasMaisJogados: (sinal?: AbortSignal) => chamar<MapaMaisJogado[]>("GET", "/mania/mapas-mais-jogados", { sinal }),
    estatisticas: (token: string, sinal?: AbortSignal) => chamar<EstatisticasDoMania>("GET", "/eu/mania/estatisticas", { token, sinal }),
  };
}

export const apiDoRanking = criarApiDoRanking();
