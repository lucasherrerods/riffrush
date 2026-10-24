import { useSyncExternalStore } from "react";

/**
 * O HUD muda quase a cada quadro (pontos durante um sustain, progresso da música).
 * Guardado fora do React, só os componentes do HUD re-renderizam, não a tela da partida inteira.
 */
export function criarLojaDoHud<T extends object>(inicial: T) {
  let atual = inicial;
  const ouvintes = new Set<() => void>();
  return {
    ler: () => atual,
    inscrever(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => void ouvintes.delete(ouvinte);
    },
    /** Só avisa quando algum valor visível mudou. */
    definir(proximo: T) {
      if (!(Object.keys(proximo) as (keyof T)[]).some((chave) => proximo[chave] !== atual[chave])) return;
      atual = proximo;
      for (const ouvinte of ouvintes) ouvinte();
    },
  };
}

export type LojaDoHud<T extends object> = ReturnType<typeof criarLojaDoHud<T>>;

export function useLoja<T extends object>(loja: LojaDoHud<T>) {
  return useSyncExternalStore(loja.inscrever, loja.ler);
}
