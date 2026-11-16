import { criarPedidoEntreModos } from "@/shared/lib/pedidoEntreModos";
import { trocarModo, type Modo } from "@/shared/modo";
import type { PessoaOnline } from "./protocolo";

/** O modo da partida da pessoa. Versões antigas não mandam o modo: aí é o Rock. */
export const modoDaPessoa = (pessoa: PessoaOnline): Modo => pessoa.estado.modo ?? "rock";

const pedido = criarPedidoEntreModos(modoDaPessoa);

/**
 * Assistir alguém: no modo aberto, abre aqui; no outro, troca de modo e deixa o pedido guardado
 * para a tela do outro modo abrir a partida assim que montar.
 */
export function assistirNoModoCerto(pessoa: PessoaOnline, modoAberto: Modo, abrirAqui: (pessoa: PessoaOnline) => void, trocar: (modo: Modo) => void = trocarModo) {
  pedido.abrirNoModoCerto(pessoa, modoAberto, abrirAqui, trocar);
}

/** O pedido de assistir que veio do outro modo, uma vez só. */
export const tirarPedidoDeAssistir = (): PessoaOnline | null => pedido.tirar();
