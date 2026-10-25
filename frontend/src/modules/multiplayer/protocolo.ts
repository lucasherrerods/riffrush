import type { Personagem } from "@/modules/character";
import type { EstadoDoJogador } from "@/modules/gameplay";
import { MUSICAS_EMBUTIDAS, type Dificuldade, type Instrumento } from "@/modules/songs";

/*
 * A sala em rede como função pura: recebe o estado e uma mensagem, devolve o estado novo
 * e o que precisa ser enviado. O servidor (Rust) só repassa; quem manda é o cliente do host.
 */

export const MAXIMO_DE_JOGADORES = 4;
/** Tempo entre o "começar" e a música: dá para todo mundo carregar e largar junto. */
export const ATRASO_DO_INICIO_MS = 5000;
/** O servidor usa o id 0 para as mensagens dele. */
const SERVIDOR = 0;

/**
 * Como uma música viaja na rede: as embutidas pelo id, as importadas pelo arquivo que o host compartilha
 * na LAN, e no online as do Encore pelo endereço de onde cada jogador baixa.
 */
export type MusicaNaRede =
  | { tipo: "embutida"; id: string }
  | { tipo: "importada"; id: string; titulo: string; artista: string; nomeDoArquivo: string }
  | { tipo: "encore"; id: string; titulo: string; artista: string; nomeDoArquivo: string; url: string };

/** O personagem como viaja na sala: com o nível da conta, quando o jogador está logado. */
export type PersonagemNaSala = Personagem & { nivel?: number };

export interface Jogador {
  id: number;
  personagem: PersonagemNaSala;
}

/** O nível vem do cliente de cada um: só um número de verdade aparece no lobby. */
const NIVEL_MAXIMO = 9999;
function limparNivel(personagem: PersonagemNaSala): PersonagemNaSala {
  const { nivel, ...resto } = personagem;
  return Number.isInteger(nivel) && nivel! >= 1 && nivel! <= NIVEL_MAXIMO ? { ...resto, nivel } : resto;
}

export type Mensagem =
  | { tipo: "bemVindo"; id: number; /** Só no online: o código para os amigos entrarem. */ codigo?: string }
  | { tipo: "cheia" }
  | { tipo: "semSala" }
  | { tipo: "saiu" }
  | { tipo: "oi"; personagem: PersonagemNaSala }
  /** O host tirou o jogador `id` da sala. */
  | { tipo: "expulsar"; id: number }
  /** O host passou a liderança para o jogador `id` (só no online). Os expulsos continuam de fora. */
  | { tipo: "transferirHost"; id: number; expulsos: number[] }
  /** Sem `instrumento` (versão antiga do jogo), a sala toca na guitarra. */
  | { tipo: "sala"; jogadores: Jogador[]; musica: MusicaNaRede; dificuldade: Dificuldade; instrumento?: Instrumento; prontos: number[] }
  /** O convidado já tem a música `musicaId` e está (ou deixou de estar) pronto para começar. */
  | { tipo: "pronto"; musicaId: string; pronto: boolean }
  | { tipo: "comecar"; musica: MusicaNaRede; dificuldade: Dificuldade; instrumento?: Instrumento }
  | ({ tipo: "estado" } & EstadoDoJogador);

export interface EstadoDaSala {
  status: "conectando" | "naSala" | "jogando";
  souHost: boolean;
  meuId: number;
  hostId: number;
  personagem: PersonagemNaSala;
  jogadores: Jogador[];
  /** Só no host: quem foi expulso não entra de novo nesta sala. */
  expulsos: number[];
  musica: MusicaNaRede;
  dificuldade: Dificuldade;
  /** O host escolhe e todos tocam no mesmo instrumento, para a pontuação ser comparável. */
  instrumento: Instrumento;
  /** Convidados prontos para a música atual. O host mantém a lista e manda para todos. */
  prontos: number[];
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

export function estadoInicial(personagem: PersonagemNaSala, souHost: boolean): EstadoDaSala {
  return {
    status: "conectando",
    souHost,
    meuId: 0,
    hostId: 0,
    personagem,
    jogadores: [],
    expulsos: [],
    musica: { tipo: "embutida", id: MUSICAS_EMBUTIDAS[0].id },
    dificuldade: "medio",
    instrumento: "guitarra",
    prontos: [],
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
  instrumento: estado.instrumento,
  prontos: estado.prontos,
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
    case "semSala":
      return { ...nada, sair: "Sala não encontrada. Confira o código ou peça um novo ao host." };
    case "oi": {
      if (!estado.souHost || estado.expulsos.includes(de)) return nada;
      const jogadores = [...estado.jogadores.filter((j) => j.id !== de), { id: de, personagem: limparNivel(mensagem.personagem) }].sort((a, b) => a.id - b.id);
      const novo = { ...estado, jogadores };
      return { estado: novo, enviar: [mensagemDaSala(novo)] };
    }
    case "saiu": {
      if (de === estado.hostId && !estado.souHost) return { ...nada, sair: "O host fechou a sala." };
      const novo = { ...estado, jogadores: estado.jogadores.filter((j) => j.id !== de), prontos: estado.prontos.filter((id) => id !== de) };
      return { estado: novo, enviar: estado.souHost ? [mensagemDaSala(novo)] : [] };
    }
    case "sala":
      if (estado.souHost) return nada;
      return {
        estado: {
          ...estado,
          hostId: de,
          jogadores: mensagem.jogadores,
          musica: mensagem.musica,
          dificuldade: mensagem.dificuldade,
          instrumento: mensagem.instrumento ?? "guitarra",
          prontos: mensagem.prontos ?? [],
        },
        enviar: [],
      };
    case "pronto": {
      if (!estado.souHost || mensagem.musicaId !== estado.musica.id) return nada;
      const outros = estado.prontos.filter((id) => id !== de);
      const novo = { ...estado, prontos: mensagem.pronto ? [...outros, de].sort((a, b) => a - b) : outros };
      return { estado: novo, enviar: [mensagemDaSala(novo)] };
    }
    case "comecar":
      return {
        estado: {
          ...estado,
          status: "jogando",
          musica: mensagem.musica,
          dificuldade: mensagem.dificuldade,
          instrumento: mensagem.instrumento ?? "guitarra",
          prontos: [],
          adversarios: {},
          partidas: estado.partidas + 1,
          inicio: agora + ATRASO_DO_INICIO_MS,
        },
        enviar: [],
      };
    case "expulsar":
      if (estado.souHost || de !== estado.hostId || mensagem.id !== estado.meuId) return nada;
      return { ...nada, sair: "O host tirou você da sala." };
    case "transferirHost": {
      if (de !== estado.hostId || estado.souHost) return nada;
      if (mensagem.id !== estado.meuId) return { estado: { ...estado, hostId: mensagem.id }, enviar: [] };
      // O antigo host vira convidado e também precisa dar pronto: a lista começa de novo.
      const novo = { ...estado, souHost: true, hostId: estado.meuId, expulsos: mensagem.expulsos.filter(Number.isInteger), prontos: [] };
      return { estado: novo, enviar: [mensagemDaSala(novo)] };
    }
    case "estado": {
      if (de === estado.meuId || de === SERVIDOR) return nada;
      const { tipo: _, ...jogada } = mensagem;
      return { estado: { ...estado, adversarios: { ...estado.adversarios, [de]: jogada } }, enviar: [] };
    }
  }
}

export function escolherMusica(estado: EstadoDaSala, musica: MusicaNaRede, dificuldade: Dificuldade, instrumento: Instrumento = "guitarra"): Reacao {
  if (!estado.souHost) return { estado, enviar: [] };
  // Música nova: cada convidado precisa baixar e dar pronto de novo.
  const prontos = musica.id === estado.musica.id ? estado.prontos : [];
  const novo = { ...estado, musica, dificuldade, instrumento, prontos };
  return { estado: novo, enviar: [mensagemDaSala(novo)] };
}

/** Só o host: tira um convidado da sala. Ele recebe o aviso e sai; se insistir, o host o ignora. */
export function expulsarJogador(estado: EstadoDaSala, id: number): Reacao {
  if (!estado.souHost || id === estado.hostId || !estado.jogadores.some((j) => j.id === id)) return { estado, enviar: [] };
  const novo = {
    ...estado,
    jogadores: estado.jogadores.filter((j) => j.id !== id),
    prontos: estado.prontos.filter((p) => p !== id),
    expulsos: [...estado.expulsos, id],
  };
  return { estado: novo, enviar: [{ tipo: "expulsar", id }, mensagemDaSala(novo)] };
}

/** Só o host, no lobby: passa a liderança para outro jogador da sala e vira convidado. */
export function transferirHost(estado: EstadoDaSala, id: number): Reacao {
  if (!estado.souHost || estado.status !== "naSala" || id === estado.meuId || !estado.jogadores.some((j) => j.id === id)) return { estado, enviar: [] };
  return { estado: { ...estado, souHost: false, hostId: id, prontos: [] }, enviar: [{ tipo: "transferirHost", id, expulsos: estado.expulsos }] };
}

/** Todos os convidados já têm a música e deram pronto. O host não precisa: ele dá a largada. */
export const todosProntos = (estado: EstadoDaSala) => estado.jogadores.every((j) => j.id === estado.hostId || estado.prontos.includes(j.id));

export function comecarPartida(estado: EstadoDaSala): Mensagem[] {
  return estado.souHost && todosProntos(estado) ? [{ tipo: "comecar", musica: estado.musica, dificuldade: estado.dificuldade, instrumento: estado.instrumento }] : [];
}
