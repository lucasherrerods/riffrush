import { useSyncExternalStore } from "react";
import { sessaoDaConta } from "@/modules/conta";
import type { Modo } from "@/shared/modo";
import { avisar } from "@/shared/ui/avisos";
import { apiDasPlaylists } from "./api";
import { LojaDePlaylists } from "./lojaDePlaylists";

let lojas: Partial<Record<Modo, LojaDePlaylists>> = {};

// Testes de outras telas trocam a conta por um falso sem a sessão: aí as playlists ficam só no aparelho.
function tokenDaConta() {
  try {
    return sessaoDaConta.token();
  } catch {
    return null;
  }
}

/** A loja de um modo, uma só para o app. */
export function lojaDoModo(modo: Modo): LojaDePlaylists {
  return (lojas[modo] ??= new LojaDePlaylists(modo, { api: apiDasPlaylists, token: tokenDaConta, avisarErro: (mensagem) => avisar.error(mensagem) }));
}

/** Para os testes começarem sem o que outro teste deixou na memória. */
export const esquecerPlaylists = () => {
  lojas = {};
};

/** As playlists de um modo, iguais em todas as telas. */
export function usePlaylists(modo: Modo) {
  const loja = lojaDoModo(modo);
  const playlists = useSyncExternalStore(loja.inscrever, loja.estado);
  return { playlists, criar: loja.criar, alternar: loja.alternar, alternarPublica: loja.alternarPublica, apagar: loja.apagar, copiar: loja.copiar };
}

export type ApiDasPlaylistsDoModo = ReturnType<typeof usePlaylists>;
