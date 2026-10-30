import type { Personagem } from "@/modules/rock/character";
import type { EstadoDoJogador } from "@/modules/rock/gameplay";
import { BALDE_CHEIO, adicionarMensagem, gastarDoBalde, limparTexto, type Balde } from "@/modules/chat";
import { MUSICAS_EMBUTIDAS, type Dificuldade, type Instrumento } from "@/modules/rock/songs";

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
  | { tipo: "importada"; id: string; titulo: string; artista: string; nomeDoArquivo: string; md5DoEncore?: string }
  | { tipo: "encore"; id: string; titulo: string; artista: string; nomeDoArquivo: string; url: string; md5DoEncore?: string };

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

/** O nome do personagem é livre: repetido, ganha um número, para ninguém se passar por outro na sala e no chat. */
function nomeUnico(nome: string, outros: Jogador[]): string {
  const base = String(nome ?? "").trim() || "Jogador";
  const usados = new Set(outros.map((j) => j.personagem.nome.trim().toLowerCase()));
  if (!usados.has(base.toLowerCase())) return base;
  let n = 2;
  while (usados.has(`${base} (${n})`.toLowerCase())) n++;
  return `${base} (${n})`;
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
  /** `rodada` junta as partidas desta largada, para o ranking contar uma vez só. Versões antigas não mandam. */
  | { tipo: "comecar"; musica: MusicaNaRede; dificuldade: Dificuldade; instrumento?: Instrumento; rodada?: string }
  | ({ tipo: "estado" } & EstadoDoJogador)
  | { tipo: "chat"; texto: string };

export interface MensagemDaSala {
  /** Ordem de chegada, para a tela. */
  n: number;
  de: number;
  autor: string;
  texto: string;
}

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
  /** A largada atual, que cada jogador manda junto com a partida. */
  rodada?: string;
  chat: MensagemDaSala[];
  /** O limite do chat de cada jogador, contado por quem recebe: um cliente modificado não inunda a sala. */
  baldesDoChat: Record<number, Balde>;
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
    chat: [],
    baldesDoChat: {},
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
      const outros = estado.jogadores.filter((j) => j.id !== de);
      const personagem = { ...limparNivel(mensagem.personagem), nome: nomeUnico(mensagem.personagem.nome, outros) };
      const jogadores = [...outros, { id: de, personagem }].sort((a, b) => a.id - b.id);
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
          // A API recusaria a partida com um id malformado: um host modificado não tira o XP de ninguém.
          rodada: typeof mensagem.rodada === "string" && ID_DA_RODADA.test(mensagem.rodada) ? mensagem.rodada : undefined,
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
    case "chat": {
      // O "de" vem do servidor, então ninguém fala pelo outro; só vale quem está na sala.
      const autor = estado.jogadores.find((j) => j.id === de)?.personagem.nome;
      const texto = limparTexto(mensagem.texto);
      if (!autor || !texto) return nada;
      const limite = gastarDoBalde(estado.baldesDoChat[de] ?? BALDE_CHEIO, agora);
      const baldesDoChat = { ...estado.baldesDoChat, [de]: limite.balde };
      if (!limite.passa) return { estado: { ...estado, baldesDoChat }, enviar: [] };
      const n = (estado.chat.at(-1)?.n ?? 0) + 1;
      return { estado: { ...estado, baldesDoChat, chat: adicionarMensagem(estado.chat, { n, de, autor, texto }) }, enviar: [] };
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

const ID_DA_RODADA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function comecarPartida(estado: EstadoDaSala, rodada: string = crypto.randomUUID()): Mensagem[] {
  return estado.souHost && todosProntos(estado) ? [{ tipo: "comecar", musica: estado.musica, dificuldade: estado.dificuldade, instrumento: estado.instrumento, rodada }] : [];
}
