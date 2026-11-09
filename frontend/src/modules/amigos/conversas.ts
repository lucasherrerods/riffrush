import type { MensagemPrivada } from "@/modules/presenca";
import type { MensagemDaApi, NaoLidasDaApi } from "./api";

export interface MensagemDaConversa {
  id: number;
  /** A conta de quem mandou. */
  de: string;
  texto: string;
  /** Quando a API guardou, em ms. */
  em: number;
}

export interface Conversa {
  /** Da mais velha para a mais nova. */
  mensagens: MensagemDaConversa[];
  naoLidas: number;
  /** Já veio o histórico da API. */
  carregada: boolean;
}

/** As conversas pelo id do amigo. */
export type Conversas = Record<string, Conversa>;

const VAZIA: Conversa = { mensagens: [], naoLidas: 0, carregada: false };

export const lerConversa = (conversas: Conversas, amigo: string): Conversa => conversas[amigo] ?? VAZIA;

/** Junta sem repetir: a mesma mensagem chega pela resposta da API e pela cópia do relay. */
function juntar(atuais: MensagemDaConversa[], novas: MensagemDaConversa[]) {
  const porId = new Map(atuais.map((m) => [m.id, m]));
  for (const m of novas) porId.set(m.id, m);
  return [...porId.values()].sort((a, b) => a.id - b.id);
}

/** Uma mensagem que o relay entregou na hora. Quem não for eu é o amigo da conversa. */
export function receberPrivada(conversas: Conversas, mensagem: MensagemPrivada, meuId: string): Conversas {
  const minha = mensagem.de.id === meuId;
  const amigo = minha ? mensagem.para : mensagem.de.id;
  const atual = lerConversa(conversas, amigo);
  const nova = !atual.mensagens.some((m) => m.id === mensagem.id);
  return {
    ...conversas,
    [amigo]: {
      ...atual,
      mensagens: juntar(atual.mensagens, [{ id: mensagem.id, de: mensagem.de.id, texto: mensagem.texto, em: mensagem.em }]),
      naoLidas: atual.naoLidas + (nova && !minha ? 1 : 0),
    },
  };
}

/** A página do histórico que a API devolveu (das mais novas para as mais velhas). */
export function juntarHistorico(conversas: Conversas, amigo: string, daApi: MensagemDaApi[]): Conversas {
  const atual = lerConversa(conversas, amigo);
  const novas = daApi.map((m) => ({ id: m.id, de: m.de, texto: m.texto, em: Date.parse(m.enviada_em) }));
  return { ...conversas, [amigo]: { ...atual, mensagens: juntar(atual.mensagens, novas), carregada: true } };
}

/** As não lidas que a API contou trocam as que o app tinha. */
export function definirNaoLidas(conversas: Conversas, daApi: NaoLidasDaApi[]): Conversas {
  const proximas: Conversas = {};
  for (const [amigo, conversa] of Object.entries(conversas)) proximas[amigo] = { ...conversa, naoLidas: 0 };
  for (const { conta_id, quantas } of daApi) proximas[conta_id] = { ...lerConversa(conversas, conta_id), naoLidas: quantas };
  return proximas;
}

export function marcarComoLida(conversas: Conversas, amigo: string): Conversas {
  if (!conversas[amigo]?.naoLidas) return conversas;
  return { ...conversas, [amigo]: { ...conversas[amigo], naoLidas: 0 } };
}

export const totalDeNaoLidas = (conversas: Conversas) => Object.values(conversas).reduce((soma, c) => soma + c.naoLidas, 0);
