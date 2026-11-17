import { useCallback, useSyncExternalStore } from "react";
import { adicionarOuTirar, apagarPlaylist, carregarPlaylists, criarPlaylist, salvarPlaylists, type Faixa, type Playlist } from "./playlists";

interface Loja {
  lista: Playlist[];
  ouvintes: Set<() => void>;
}

const lojas = new Map<string, Loja>();

function lojaDa(chave: string): Loja {
  let loja = lojas.get(chave);
  if (!loja) {
    loja = { lista: carregarPlaylists(chave), ouvintes: new Set() };
    lojas.set(chave, loja);
  }
  return loja;
}

function mudar(chave: string, mudanca: (lista: Playlist[]) => Playlist[]) {
  const loja = lojaDa(chave);
  loja.lista = mudanca(loja.lista);
  salvarPlaylists(chave, loja.lista);
  loja.ouvintes.forEach((ouvir) => ouvir());
}

/** Para os testes começarem sem o que outro teste deixou na memória. */
export const esquecerPlaylists = () => lojas.clear();

/** As playlists de um modo, iguais em todas as telas que usam a mesma chave. */
export function usePlaylists(chave: string) {
  const inscrever = useCallback(
    (ouvir: () => void) => {
      const loja = lojaDa(chave);
      loja.ouvintes.add(ouvir);
      return () => loja.ouvintes.delete(ouvir);
    },
    [chave],
  );
  const playlists = useSyncExternalStore(inscrever, () => lojaDa(chave).lista);
  return {
    playlists,
    /** Cria e devolve o id da nova. */
    criar: (nome: string) => {
      let id = "";
      mudar(chave, (lista) => {
        const nova = criarPlaylist(lista, nome);
        id = nova[nova.length - 1].id;
        return nova;
      });
      return id;
    },
    alternar: (id: string, faixa: Faixa) => mudar(chave, (lista) => adicionarOuTirar(lista, id, faixa)),
    apagar: (id: string) => mudar(chave, (lista) => apagarPlaylist(lista, id)),
  };
}

export type ApiDasPlaylists = ReturnType<typeof usePlaylists>;
