import type { SugestaoDeMusica } from "@/modules/presenca";
import { criarPedidoEntreModos } from "@/shared/lib/pedidoEntreModos";

const pedido = criarPedidoEntreModos((sugestao: SugestaoDeMusica) => sugestao.modo);

/** Tocar a música sugerida: no modo dela abre aqui; no outro, troca de modo e o outro modo abre ao montar. */
export const tocarSugestaoNoModoCerto = pedido.abrirNoModoCerto;

/** A sugestão que veio do outro modo para tocar, uma vez só. */
export const tirarSugestaoPendente = (): SugestaoDeMusica | null => pedido.tirar();
