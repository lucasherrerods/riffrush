import { openUrl } from "@tauri-apps/plugin-opener";

/** Abre um link externo: no app do PC vai para o navegador do sistema; no navegador, para uma aba nova. */
export async function abrirLink(url: string) {
  if ("__TAURI_INTERNALS__" in window) return openUrl(url);
  window.open(url, "_blank", "noopener,noreferrer");
}
