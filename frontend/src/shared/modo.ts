import { useSyncExternalStore } from "react";

/** Os jogos do app. Cada um tem as próprias regras, biblioteca, ranking e tema. */
export type Modo = "rock" | "mania";

export const NOME_DO_MODO: Record<Modo, string> = { rock: "Rock", mania: "Mania" };

/** O modo que veio de fora (relay, API), ou nada quando não é um dos conhecidos. */
export const lerModo = (valor: unknown): Modo | undefined => (valor === "rock" || valor === "mania" ? valor : undefined);

export const CHAVE_DO_MODO = "riffrush.modo";

export function carregarModo(): Modo {
  let salvo: string | null = null;
  try {
    salvo = localStorage.getItem(CHAVE_DO_MODO);
  } catch {
    // Sem armazenamento (aba privada): abre no Rock.
  }
  return lerModo(salvo) ?? "rock";
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

/** O modo aberto agora, para quem não é componente (a presença, o chat, as chamadas à API). */
export const lerModoAberto = () => modoAtual;
