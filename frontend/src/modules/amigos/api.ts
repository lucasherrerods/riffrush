import { URL_DA_API, criarCliente } from "@/shared/lib/api";

/** Alguém nas listas de amizade, como a API devolve. */
export interface PessoaDaAmizade {
  conta_id: string;
  nome: string;
  avatar: string | null;
  nivel: number;
  /** A última vez que abriu o jogo logada. */
  visto_em: string | null;
  desde: string;
}

export interface ListasDeAmigos {
  /** O código que a conta passa para ser adicionada. */
  codigo: string;
  amigos: PessoaDaAmizade[];
  recebidos: PessoaDaAmizade[];
  enviados: PessoaDaAmizade[];
  bloqueados: PessoaDaAmizade[];
}

export interface SugestaoDeAmizade {
  conta_id: string;
  nome: string;
  avatar: string | null;
  nivel: number;
  amigos_em_comum: number;
}

/** Para quem vai o pedido: pelo código de amigo ou pela conta. */
export type AlvoDoPedido = { codigo: string } | { conta_id: string };

export function criarApiDosAmigos(base: string, buscar?: typeof fetch) {
  const chamar = criarCliente(base, buscar);
  const daConta = (id: string) => `/amigos/${encodeURIComponent(id)}`;
  return {
    listas: (token: string) => chamar<ListasDeAmigos>("GET", "/amigos", { token }),
    sugestoes: (token: string) => chamar<SugestaoDeAmizade[]>("GET", "/amigos/sugestoes", { token }),
    /** `amigos` vem `true` quando a outra pessoa já tinha pedido: viraram amigos na hora. */
    pedir: (token: string, alvo: AlvoDoPedido) => chamar<{ amigos: boolean }>("POST", "/amigos/pedidos", { token, corpo: alvo }),
    aceitar: (token: string, contaId: string) => chamar<void>("POST", `${daConta(contaId)}/aceitar`, { token }),
    /** Remove o amigo, recusa o pedido recebido ou cancela o enviado. */
    desfazer: (token: string, contaId: string) => chamar<void>("DELETE", daConta(contaId), { token }),
    bloquear: (token: string, contaId: string) => chamar<void>("POST", `${daConta(contaId)}/bloqueio`, { token }),
    desbloquear: (token: string, contaId: string) => chamar<void>("DELETE", `${daConta(contaId)}/bloqueio`, { token }),
  };
}

export type ApiDosAmigos = ReturnType<typeof criarApiDosAmigos>;

export const apiDosAmigos = criarApiDosAmigos(URL_DA_API);
