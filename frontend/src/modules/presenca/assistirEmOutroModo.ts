import { trocarModo, type Modo } from "@/shared/modo";
import type { PessoaOnline } from "./protocolo";

let pendente: PessoaOnline | null = null;

/** O modo da partida da pessoa. Versões antigas não mandam o modo: aí é o Rock. */
export const modoDaPessoa = (pessoa: PessoaOnline): Modo => pessoa.estado.modo ?? "rock";

/**
 * Assistir alguém: no modo aberto, abre aqui; no outro, troca de modo e deixa o pedido guardado
 * para a tela do outro modo abrir a partida assim que montar.
 */
export function assistirNoModoCerto(pessoa: PessoaOnline, modoAberto: Modo, abrirAqui: (pessoa: PessoaOnline) => void, trocar: (modo: Modo) => void = trocarModo) {
  const modo = modoDaPessoa(pessoa);
  if (modo === modoAberto) return abrirAqui(pessoa);
  pendente = pessoa;
  trocar(modo);
}

/** O pedido de assistir que veio do outro modo, uma vez só. */
export function tirarPedidoDeAssistir(): PessoaOnline | null {
  const pessoa = pendente;
  pendente = null;
  return pessoa;
}
