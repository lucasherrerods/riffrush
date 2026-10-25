import { useSyncExternalStore } from "react";

const algumConectado = () => Array.from(navigator.getGamepads?.() ?? []).some((c) => c);

function inscrever(ouvinte: () => void) {
  window.addEventListener("gamepadconnected", ouvinte);
  window.addEventListener("gamepaddisconnected", ouvinte);
  return () => {
    window.removeEventListener("gamepadconnected", ouvinte);
    window.removeEventListener("gamepaddisconnected", ouvinte);
  };
}

/** Se há um controle ligado agora. O navegador só avisa depois que um botão é apertado. */
export function useControleConectado() {
  return useSyncExternalStore(inscrever, algumConectado);
}
