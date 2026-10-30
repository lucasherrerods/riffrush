import { invoke, isTauri } from "@tauri-apps/api/core";

const COM_CTRL = new Set(["KeyR", "KeyP", "Equal", "Minus", "Digit0", "NumpadAdd", "NumpadSubtract", "Numpad0"]);

/** Atalhos do WebView2 que tirariam o jogador da partida (recarregar, imprimir, ferramentas, zoom). */
export function ehAtalhoDoNavegador(evento: KeyboardEvent) {
  if (evento.code === "F5" || evento.code === "F12") return true;
  if (!evento.ctrlKey && !evento.metaKey) return false;
  return COM_CTRL.has(evento.code) || (evento.shiftKey && ["KeyI", "KeyJ", "KeyC"].includes(evento.code));
}

/** No app desktop do Windows, segura as teclas Windows, Alt, F10 e Alt+Tab enquanto a janela estiver em foco. */
export async function bloquearTeclasDoSistema(ligar: boolean) {
  if (!isTauri()) return;
  try {
    await invoke("teclado_bloquear", { ligar });
  } catch {
    // Sem o bloqueio a partida segue normal.
  }
}
