import { useSyncExternalStore } from "react";
import { sessaoDaConta } from "@/modules/conta";
import { URL_DO_RELAY } from "@/modules/multiplayer";
import { apiDaPresenca } from "./api";
import { ConexaoDePresenca } from "./conexao";
import { criarTransmissao, type PartidaParaTransmitir } from "./transmissao";

const pedirFicha = () => {
  const token = sessaoDaConta.token();
  return token ? apiDaPresenca.ficha(token) : Promise.reject(new Error("Sem sessão."));
};

/** Precisa do relay (VITE_URL_DO_RELAY) e da API; sem eles a lista de quem está online some do menu. */
export const presencaDisponivel = !!URL_DO_RELAY;

/** A conexão com a lista de quem está online, uma só para o app. */
export const presenca = new ConexaoDePresenca({ urlDoRelay: URL_DO_RELAY, pedirFicha });

export function usePresenca() {
  return useSyncExternalStore(presenca.inscrever, presenca.estado);
}

/** Uma transmissão nova para a partida que vai começar. */
export const transmitirPartida = (partida: PartidaParaTransmitir) => criarTransmissao(partida, { urlDoRelay: URL_DO_RELAY, pedirFicha });
