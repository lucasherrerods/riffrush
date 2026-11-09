import { adicionarMensagem } from "@/modules/chat";
import type { MensagemPrivada } from "@/modules/presenca";

export type MensagemDaConversa = MensagemPrivada & { minha: boolean };

export interface Conversa {
  mensagens: MensagemDaConversa[];
  naoLidas: number;
}

/** As conversas abertas neste aparelho, pelo id do amigo. Somem ao fechar o app. */
export type Conversas = Record<string, Conversa>;

const VAZIA: Conversa = { mensagens: [], naoLidas: 0 };

export const lerConversa = (conversas: Conversas, amigo: string): Conversa => conversas[amigo] ?? VAZIA;

/**
 * O relay entrega de qualquer conta e devolve a cópia de quem mandou.
 * Se quem mandou é amigo, a mensagem é dele; se quem recebe é amigo, é minha.
 */
export function receberPrivada(conversas: Conversas, mensagem: MensagemPrivada, amigos: ReadonlySet<string>): Conversas {
  const minha = !amigos.has(mensagem.de.id);
  const amigo = minha ? mensagem.para : mensagem.de.id;
  if (!amigos.has(amigo)) return conversas;
  const atual = lerConversa(conversas, amigo);
  return {
    ...conversas,
    [amigo]: { mensagens: adicionarMensagem(atual.mensagens, { ...mensagem, minha }), naoLidas: atual.naoLidas + (minha ? 0 : 1) },
  };
}

export function marcarComoLida(conversas: Conversas, amigo: string): Conversas {
  if (!conversas[amigo]?.naoLidas) return conversas;
  return { ...conversas, [amigo]: { ...conversas[amigo], naoLidas: 0 } };
}

export const totalDeNaoLidas = (conversas: Conversas) => Object.values(conversas).reduce((soma, c) => soma + c.naoLidas, 0);
