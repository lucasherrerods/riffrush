import { useSyncExternalStore } from "react";
import { sessaoDaConta, useConta } from "@/modules/conta";
import { URL_DO_RELAY } from "@/modules/multiplayer";
import { apiDaPresenca } from "./api";
import { ConexaoDoChatGlobal } from "./conexaoDoChat";
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

/** A conexão com o chat global, uma só para o app. */
export const chatGlobal = new ConexaoDoChatGlobal({ urlDoRelay: URL_DO_RELAY, pedirFicha });

export function usePresenca() {
  return useSyncExternalStore(presenca.inscrever, presenca.estado);
}

/** Uma transmissão nova para a partida que vai começar. */
export const transmitirPartida = (partida: PartidaParaTransmitir, aoContarEspectadores?: (quantos: number) => void) =>
  criarTransmissao(partida, { urlDoRelay: URL_DO_RELAY, pedirFicha, aoContarEspectadores });

/** O último status de moderação visto de cada conta: o chat só fica conectado no menu. */
const moderacaoConhecida = new Map<string, boolean>();

/** Se quem está jogando é da moderação do chat. Com o chat desconectado (fora do menu), vale o último status visto. */
export function useSouDaModeracao() {
  const { conta } = useConta();
  const agora = useSyncExternalStore(chatGlobal.inscrever, () => chatGlobal.estado().voce?.admin);
  if (!conta) return false;
  if (agora !== undefined) moderacaoConhecida.set(conta.id, agora);
  return moderacaoConhecida.get(conta.id) ?? false;
}
