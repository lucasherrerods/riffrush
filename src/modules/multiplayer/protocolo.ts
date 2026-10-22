import type { Personagem } from "@/modules/character";
import type { EstadoDoJogador } from "@/modules/gameplay";
import type { Dificuldade } from "@/modules/songs";

/*
 * A sala em rede como função pura: recebe o estado e uma mensagem, devolve o estado novo
 * e o que precisa ser enviado. O servidor (Rust) só repassa; quem manda é o cliente do host.
 */

export const MAXIMO_DE_JOGADORES = 4;
/** Tempo entre o "começar" e a música: dá para todo mundo carregar e largar junto. */
export const ATRASO_DO_INICIO_MS = 5000;
/** O servidor usa o id 0 para as mensagens dele. */
const SERVIDOR = 0;

/** Como uma música viaja na rede: as embutidas pelo id, as importadas pelo arquivo que o host compartilha. */
export type MusicaNaRede =
  | { tipo: "embutida"; id: string }
  | { tipo: "importada"; id: string; titulo: string; artista: string; nomeDoArquivo: string };

export interface Jogador {
  id: number;
  personagem: Personagem;
}

export type Mensagem =
  | { tipo: "bemVindo"; id: number }
  | { tipo: "cheia" }
  | { tipo: "saiu" }
  | { tipo: "oi"; personagem: Personagem }
  | { tipo: "sala"; jogadores: Jogador[]; musica: MusicaNaRede; dificuldade: Dificuldade }
  | { tipo: "comecar"; musica: MusicaNaRede; dificuldade: Dificuldade }
  | ({ tipo: "estado" } & EstadoDoJogador);

export interface EstadoDaSala {
  status: "conectando" | "naSala" | "jogando";
  souHost: boolean;
  meuId: number;
  hostId: number;
  personagem: Personagem;
  jogadores: Jogador[];
  musica: MusicaNaRede;
  dificuldade: Dificuldade;
  adversarios: Record<number, EstadoDoJogador>;
  /** Conta quantas partidas começaram: a tela de jogo abre a cada aumento. */
  partidas: number;
  /** Instante (performance.now) em que a música começa para todos. */
  inicio: number;
}

export interface Reacao {
  estado: EstadoDaSala;
  enviar: Mensagem[];
  /** Quando existe, a sala acabou para este jogador, com esse aviso. */
  sair?: string;
}

export function estadoInicial(personagem: Personagem, souHost: boolean): EstadoDaSala {
  return {
    status: "conectando",
    souHost,
    meuId: 0,
    hostId: 0,
    personagem,
    jogadores: [],
    musica: { tipo: "embutida", id: "neon-highway" },
    dificuldade: "medio",
    adversarios: {},
    partidas: 0,
    inicio: 0,
  };
}

const mensagemDaSala = (estado: EstadoDaSala): Mensagem => ({
  tipo: "sala",
  jogadores: estado.jogadores,
  musica: estado.musica,
  dificuldade: estado.dificuldade,
});

/** Atualiza a sala com uma mensagem recebida de `de`. `agora` é o performance.now() da chegada. */
export function reduzir(estado: EstadoDaSala, de: number, mensagem: Mensagem, agora: number): Reacao {
  const nada = { estado, enviar: [] };
  switch (mensagem.tipo) {
    case "bemVindo":
      return {
        estado: { ...estado, status: "naSala", meuId: mensagem.id, hostId: estado.souHost ? mensagem.id : estado.hostId },
        enviar: [{ tipo: "oi", personagem: estado.personagem }],
      };
    case "cheia":
      return { ...nada, sair: `A sala já tem ${MAXIMO_DE_JOGADORES} jogadores.` };
    case "oi": {
      if (!estado.souHost) return nada;
      const jogadores = [...estado.jogadores.filter((j) => j.id !== de), { id: de, personagem: mensagem.personagem }].sort((a, b) => a.id - b.id);
      const novo = { ...estado, jogadores };
      return { estado: novo, enviar: [mensagemDaSala(novo)] };
    }
    case "saiu": {
      if (de === estado.hostId && !estado.souHost) return { ...nada, sair: "O host fechou a sala." };
      const novo = { ...estado, jogadores: estado.jogadores.filter((j) => j.id !== de) };
      return { estado: novo, enviar: estado.souHost ? [mensagemDaSala(novo)] : [] };
    }
    case "sala":
      if (estado.souHost) return nada;
      return { estado: { ...estado, hostId: de, jogadores: mensagem.jogadores, musica: mensagem.musica, dificuldade: mensagem.dificuldade }, enviar: [] };
    case "comecar":
      return {
        estado: {
          ...estado,
          status: "jogando",
          musica: mensagem.musica,
          dificuldade: mensagem.dificuldade,
          adversarios: {},
          partidas: estado.partidas + 1,
          inicio: agora + ATRASO_DO_INICIO_MS,
        },
        enviar: [],
      };
    case "estado": {
      if (de === estado.meuId || de === SERVIDOR) return nada;
      const { tipo: _, ...jogada } = mensagem;
      return { estado: { ...estado, adversarios: { ...estado.adversarios, [de]: jogada } }, enviar: [] };
    }
  }
}

export function escolherMusica(estado: EstadoDaSala, musica: MusicaNaRede, dificuldade: Dificuldade): Reacao {
  if (!estado.souHost) return { estado, enviar: [] };
  const novo = { ...estado, musica, dificuldade };
  return { estado: novo, enviar: [mensagemDaSala(novo)] };
}

export function comecarPartida(estado: EstadoDaSala): Mensagem[] {
  return estado.souHost ? [{ tipo: "comecar", musica: estado.musica, dificuldade: estado.dificuldade }] : [];
}
