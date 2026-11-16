import { trocarModo, type Modo } from "@/shared/modo";

/**
 * Um pedido que pode ser do outro modo (assistir alguém, tocar uma música sugerida): no modo aberto,
 * abre na hora; no outro, troca de modo e guarda o pedido para a tela do outro modo abrir ao montar.
 */
export function criarPedidoEntreModos<T>(modoDe: (pedido: T) => Modo) {
  let pendente: T | null = null;
  return {
    abrirNoModoCerto(pedido: T, modoAberto: Modo, abrirAqui: (pedido: T) => void, trocar: (modo: Modo) => void = trocarModo) {
      const modo = modoDe(pedido);
      if (modo === modoAberto) return abrirAqui(pedido);
      pendente = pedido;
      trocar(modo);
    },
    /** O pedido que veio do outro modo, uma vez só. */
    tirar(): T | null {
      const pedido = pendente;
      pendente = null;
      return pedido;
    },
  };
}
