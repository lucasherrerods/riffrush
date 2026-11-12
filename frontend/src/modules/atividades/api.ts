import { URL_DA_API, criarCliente } from "@/shared/lib/api";

/** O que aconteceu, como a API devolve. */
export type EventoDaAtividade =
  | {
      tipo: "partida_do_rock";
      musica_id: string;
      titulo: string | null;
      artista: string | null;
      instrumento: string;
      dificuldade: string;
      precisao: number | null;
      derrota: boolean;
    }
  | {
      tipo: "partida_do_mania";
      beatmap_id: number;
      beatmapset_id: number | null;
      titulo: string | null;
      artista: string | null;
      dificuldade: string | null;
      precisao: number;
      derrota: boolean;
    }
  | { tipo: "conta_nova" };

export interface Atividade {
  conta_id: string;
  nome: string;
  avatar: string | null;
  /** ISO 8601. */
  quando: string;
  evento: EventoDaAtividade;
}

export function criarApiDeAtividades(base = URL_DA_API, buscar?: typeof fetch) {
  const chamar = criarCliente(base, buscar);
  return {
    /** As mais recentes; com `antes`, as que vieram antes desse momento. */
    recentes: (antes?: string, sinal?: AbortSignal) =>
      chamar<Atividade[]>("GET", `/atividades${antes ? `?antes=${encodeURIComponent(antes)}` : ""}`, { sinal }),
  };
}

export const apiDeAtividades = criarApiDeAtividades();
