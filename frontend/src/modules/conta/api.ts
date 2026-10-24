import { ErroDaApi, criarCliente } from "@/shared/lib/api";

/** Os formatos que a API devolve, em snake_case como no JSON. */
export interface NivelDaConta {
  nivel: number;
  xp_no_nivel: number;
  xp_para_o_proximo: number;
}

export interface ContaDaApi {
  id: string;
  nome: string;
  avatar: string | null;
  xp_total: number;
  nivel: NivelDaConta;
}

export interface XpDaPartida {
  xp_ganho: number;
  antes: NivelDaConta;
  depois: NivelDaConta;
}

export interface PartidaParaAApi {
  musica_id: string;
  dificuldade: string;
  pontos: number;
  acertos: number;
  total: number;
  derrota: boolean;
  fantasma: boolean;
}

/** O Google tem um client id para a web e outro para o desktop (que aceita qualquer porta no loopback). */
export type ClienteDoGoogle = "web" | "desktop";

export { ErroDaApi };

export function criarApi(base: string, buscar?: typeof fetch) {
  const chamar = criarCliente(base, buscar);
  return {
    entrar: (codigo: string, verificador: string, redirect_uri: string, cliente: ClienteDoGoogle) =>
      chamar<{ token: string; conta: ContaDaApi }>("POST", "/auth/google", { corpo: { codigo, verificador, redirect_uri, cliente } }),
    eu: (token: string) => chamar<ContaDaApi>("GET", "/eu", { token }),
    sair: (token: string) => chamar<void>("POST", "/auth/sair", { token }),
    excluirConta: (token: string) => chamar<void>("DELETE", "/eu", { token }),
    registrarPartida: (token: string, partida: PartidaParaAApi) => chamar<XpDaPartida>("POST", "/partidas", { token, corpo: partida }),
  };
}

export type ApiDaConta = ReturnType<typeof criarApi>;
