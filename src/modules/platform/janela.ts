import { getCurrentWindow } from "@tauri-apps/api/window";

/** A janela nativa do Tauri, ou null quando o jogo roda num navegador (ex.: celular na LAN). */
function janelaNativa() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

export async function estaEmTelaCheia() {
  const janela = janelaNativa();
  return janela ? janela.isFullscreen() : Boolean(document.fullscreenElement);
}

export async function definirTelaCheia(ligada: boolean) {
  const janela = janelaNativa();
  if (janela) return janela.setFullscreen(ligada);
  if (ligada) await document.documentElement.requestFullscreen();
  else if (document.fullscreenElement) await document.exitFullscreen();
}

export async function fecharJanela() {
  const janela = janelaNativa();
  if (janela) await janela.close();
  else window.close();
}
