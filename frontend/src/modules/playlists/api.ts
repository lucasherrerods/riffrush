import type { Modo } from "@/shared/modo";
import { URL_DA_API, criarCliente } from "@/shared/lib/api";
import type { Faixa } from "./playlists";

/** Uma playlist como a API guarda: a da conta logada ou a que um amigo deixou visível. */
export interface PlaylistDaApi {
  id: string;
  nome: string;
  modo: Modo;
  publica: boolean;
  faixas: Faixa[];
  atualizada_em: string;
}

export function criarApiDasPlaylists(base: string, buscar?: typeof fetch) {
  const chamar = criarCliente(base, buscar);
  return {
    minhas: (token: string) => chamar<PlaylistDaApi[]>("GET", "/eu/playlists", { token }),
    guardar: (token: string, id: string, corpo: { nome: string; modo: Modo; publica: boolean; faixas: Faixa[] }) =>
      chamar<PlaylistDaApi>("PUT", `/eu/playlists/${encodeURIComponent(id)}`, { token, corpo }),
    apagar: (token: string, id: string) => chamar<void>("DELETE", `/eu/playlists/${encodeURIComponent(id)}`, { token }),
    doAmigo: (token: string, contaId: string, sinal?: AbortSignal) => chamar<PlaylistDaApi[]>("GET", `/amigos/${encodeURIComponent(contaId)}/playlists`, { token, sinal }),
  };
}

export type ApiDasPlaylists = ReturnType<typeof criarApiDasPlaylists>;

export const apiDasPlaylists = criarApiDasPlaylists(URL_DA_API);
