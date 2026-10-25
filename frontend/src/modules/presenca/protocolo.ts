import { codigoDaEntrada, emTicks, entradaDoCodigo, type EntradaDoReplay } from "@/modules/gameplay";
import type { Dificuldade, Instrumento } from "@/modules/songs";

// O mesmo contrato do relay (backend/relay/src/presenca.ts), que é publicado à parte.

/** Onde a pessoa está. A música vai com o id do ranking, para quem assiste achar a mesma. */
export type EstadoOnline =
  | { tipo: "menu" }
  | { tipo: "tocando"; musica: string; titulo: string; artista: string; dificuldade: Dificuldade; instrumento: Instrumento; transmitindo: boolean };

export interface PessoaOnline {
  id: string;
  nome: string;
  avatar: string | null;
  estado: EstadoOnline;
}

type MensagemDaPresenca = { tipo: "lista"; pessoas: PessoaOnline[] } | { tipo: "pessoa"; pessoa: PessoaOnline } | { tipo: "saiu"; id: string };

/** A partida que quem assiste precisa montar igual. */
export interface PartidaTransmitida {
  musica: string;
  dificuldade: Dificuldade;
  instrumento: Instrumento;
  hashDoChart: string;
  semFalha: boolean;
  /** O .sng no Encore, para quem assiste baixar com um clique. Só confiável depois de `linkDoChartConfere`. */
  urlDoEncore?: string;
}

export type MensagemDaTransmissao =
  | { tipo: "inicio"; partida: PartidaTransmitida }
  | { tipo: "lote"; ate: number; entradas: [number, number][] }
  | { tipo: "pausa"; pausado: boolean }
  | { tipo: "fim" }
  | { tipo: "semPartida" };

const semBarraNoFim = (url: string) => url.replace(/\/+$/, "");

/**
 * A ficha vai como subprotocolo do WebSocket, não na URL: a URL acaba em logs.
 * O relay responde aceitando PROTOCOLO_DO_JOGO.
 */
export const PROTOCOLO_DO_JOGO = "riffrush";
export const protocolosComFicha = (ficha: string) => [PROTOCOLO_DO_JOGO, ficha];

export const urlDaPresenca = (relay: string) => `${semBarraNoFim(relay)}/presenca`;

export const urlDoChat = (relay: string) => `${semBarraNoFim(relay)}/chat`;

/** Com a ficha (no subprotocolo), quem joga transmite; sem ela, quem assiste só recebe. */
export const urlDaTransmissao = (relay: string, contaId: string) => `${semBarraNoFim(relay)}/transmissao/${contaId}`;

/** Aplica uma mensagem do relay na lista; mensagem estranha não mexe em nada. */
export function aplicarMensagem(pessoas: PessoaOnline[], bruta: string): PessoaOnline[] {
  let msg: MensagemDaPresenca;
  try {
    msg = JSON.parse(bruta);
  } catch {
    return pessoas;
  }
  if (msg?.tipo === "lista" && Array.isArray(msg.pessoas)) return msg.pessoas;
  if (msg?.tipo === "pessoa" && msg.pessoa?.id) return [...pessoas.filter((p) => p.id !== msg.pessoa.id), msg.pessoa];
  if (msg?.tipo === "saiu") return pessoas.filter((p) => p.id !== msg.id);
  return pessoas;
}

/** Quem dá para assistir agora vem primeiro, depois quem está tocando, e por fim quem está no menu; dentro de cada grupo, por nome. */
export function ordenarPessoas(pessoas: PessoaOnline[], euId: string | null): PessoaOnline[] {
  const peso = (p: PessoaOnline) => (p.estado.tipo === "tocando" ? (p.estado.transmitindo ? 0 : 1) : 2);
  return pessoas.filter((p) => p.id !== euId).sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export const entradasParaOLote = (entradas: EntradaDoReplay[]): [number, number][] => entradas.map((e) => [emTicks(e.tempo), codigoDaEntrada(e)]);
export const entradasDoLote = (lote: [number, number][]): EntradaDoReplay[] => lote.map(([ticks, codigo]) => entradaDoCodigo(ticks, codigo));

/** O relay conta a quem joga quantas pessoas estão assistindo. Outra mensagem dá `null`. */
export function lerAvisoDeEspectadores(bruta: unknown): number | null {
  if (typeof bruta !== "string") return null;
  try {
    const msg = JSON.parse(bruta);
    return msg?.tipo === "espectadores" && Number.isInteger(msg.quantos) && msg.quantos >= 0 ? msg.quantos : null;
  } catch {
    return null;
  }
}

export function lerMensagemDaTransmissao(bruta: string): MensagemDaTransmissao | null {
  try {
    const msg = JSON.parse(bruta);
    return typeof msg?.tipo === "string" ? msg : null;
  } catch {
    return null;
  }
}
