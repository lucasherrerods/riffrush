import { PhysicalPosition, PhysicalSize, currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { planoDaJanela, type Monitor, type ModoDeJanela } from "./modoDeJanela";

/** A janela nativa do Tauri, ou null quando o jogo roda num navegador (ex.: celular na LAN). */
function janelaNativa() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

/** Só o app desktop escolhe modo de janela e resolução; no navegador vale a tela cheia dele. */
export const ehJanelaNativa = () => janelaNativa() !== null;

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

/** O monitor onde a janela está agora, em pixels físicos. */
export async function monitorAtual(): Promise<Monitor | null> {
  if (!janelaNativa()) return null;
  const monitor = await currentMonitor();
  if (!monitor) return null;
  return { x: monitor.position.x, y: monitor.position.y, largura: monitor.size.width, altura: monitor.size.height };
}

/** Coloca a janela nativa no modo. Pixels físicos, para o tamanho não dobrar em telas com escala do Windows. */
export async function aplicarModoDeJanela(modo: ModoDeJanela, resolucao: string | null) {
  const janela = janelaNativa();
  if (!janela) return;
  const plano = planoDaJanela(modo, resolucao, await monitorAtual());
  // A tela cheia sai primeiro: com ela ligada, o sistema ignora tamanho e posição.
  if (!plano.telaCheia) await janela.setFullscreen(false);
  await janela.setDecorations(plano.bordas);
  if (plano.tamanho) await janela.setSize(new PhysicalSize(plano.tamanho.largura, plano.tamanho.altura));
  if (plano.posicao) await janela.setPosition(new PhysicalPosition(plano.posicao.x, plano.posicao.y));
  if (plano.centralizar) await janela.center();
  if (plano.telaCheia) await janela.setFullscreen(true);
}

export async function fecharJanela() {
  const janela = janelaNativa();
  if (janela) await janela.close();
  else window.close();
}
