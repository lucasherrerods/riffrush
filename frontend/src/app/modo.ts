import { useSyncExternalStore } from "react";

/** Os jogos do app. Cada um tem as próprias regras, biblioteca, ranking e tema. */
export type Modo = "rock" | "mania";

export const CHAVE_DO_MODO = "riffrush.modo";

/** O Mania fica escondido até estar pronto para jogar. */
export const MANIA_LIGADO = import.meta.env.VITE_MODO_MANIA === "1";

export function modosDisponiveis(maniaLigado = MANIA_LIGADO): Modo[] {
  return maniaLigado ? ["rock", "mania"] : ["rock"];
}

export function carregarModo(maniaLigado = MANIA_LIGADO): Modo {
  let salvo: string | null = null;
  try {
    salvo = localStorage.getItem(CHAVE_DO_MODO);
  } catch {
    // Sem armazenamento (aba privada): abre no Rock.
  }
  return modosDisponiveis(maniaLigado).find((m) => m === salvo) ?? "rock";
}

let modoAtual = carregarModo();
const ouvintes = new Set<() => void>();

export function trocarModo(modo: Modo) {
  if (modo === modoAtual) return;
  modoAtual = modo;
  try {
    localStorage.setItem(CHAVE_DO_MODO, modo);
  } catch {
    // Sem armazenamento: vale só até fechar o app.
  }
  ouvintes.forEach((ouvir) => ouvir());
}

export function useModo(): Modo {
  return useSyncExternalStore(
    (ouvir) => {
      ouvintes.add(ouvir);
      return () => ouvintes.delete(ouvir);
    },
    () => modoAtual,
  );
}
