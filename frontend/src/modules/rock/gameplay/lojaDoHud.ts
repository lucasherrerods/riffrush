import { useCallback, useRef, useSyncExternalStore } from "react";

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
    /** Só avisa quando algum valor visível mudou. Roda todo quadro: compara sem criar lista de chaves. */
    definir(proximo: T) {
      let mudou = false;
      for (const chave in proximo) {
        if (proximo[chave] !== atual[chave]) {
          mudou = true;
          break;
        }
      }
      if (!mudou) return;
      atual = proximo;
      for (const ouvinte of ouvintes) ouvinte();
    },
  };
}

export type LojaDoHud<T extends object> = ReturnType<typeof criarLojaDoHud<T>>;

/** Mesmos valores, campo a campo (ou o mesmo valor, quando o seletor devolve um só). */
function iguais(a: unknown, b: unknown) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  for (const chave in x) if (!Object.is(x[chave], y[chave])) return false;
  for (const chave in y) if (!(chave in x)) return false;
  return true;
}

/**
 * Lê a loja. Com `seletor`, o componente só re-renderiza quando o pedaço que ele usa muda:
 * os pontos de um sustain não redesenham o medidor de vida.
 */
export function useLoja<T extends object>(loja: LojaDoHud<T>): T;
export function useLoja<T extends object, S>(loja: LojaDoHud<T>, seletor: (estado: T) => S): S;
export function useLoja<T extends object, S>(loja: LojaDoHud<T>, seletor?: (estado: T) => S) {
  const ultimo = useRef<{ estado: T; selecionado: S } | null>(null);
  const seletorAtual = useRef(seletor);
  seletorAtual.current = seletor;
  const ler = useCallback(() => {
    const estado = loja.ler();
    const escolher = seletorAtual.current;
    if (!escolher) return estado;
    if (ultimo.current?.estado === estado) return ultimo.current.selecionado;
    const selecionado = escolher(estado);
    // Mantém o objeto anterior quando nada mudou: o React compara pela referência.
    const valor = ultimo.current && iguais(ultimo.current.selecionado, selecionado) ? ultimo.current.selecionado : selecionado;
    ultimo.current = { estado, selecionado: valor };
    return valor;
  }, [loja]);
  return useSyncExternalStore(loja.inscrever, ler);
}
