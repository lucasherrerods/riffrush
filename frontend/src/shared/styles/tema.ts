import { useSyncExternalStore } from "react";
import { TEMA_PADRAO, type Tema } from "./temas";
import { aplicarTokens } from "./tokens";

let atual: Tema = TEMA_PADRAO;
const ouvintes = new Set<() => void>();

/** Troca o tema da interface na hora: as telas leem as variáveis CSS, então mudam sem recarregar. */
export function definirTema(tema: Tema, raiz: HTMLElement = document.documentElement) {
  aplicarTokens(raiz, tema);
  raiz.style.colorScheme = tema.esquema === "claro" ? "light" : "dark";
  if (tema === atual) return;
  atual = tema;
  ouvintes.forEach((ouvir) => ouvir());
}

export const lerTema = () => atual;

export function useTema(): Tema {
  return useSyncExternalStore(
    (ouvir) => {
      ouvintes.add(ouvir);
      return () => ouvintes.delete(ouvir);
    },
    lerTema,
  );
}
