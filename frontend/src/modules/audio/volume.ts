import { obterContextoDeAudio } from "./contexto";

const PASSO = 0.05;
/** Rampa curta ao mudar o volume: pular direto para o valor novo dá um estalo. */
const SUAVIZACAO = 0.015;

/** O próximo volume ao subir (1) ou descer (-1) um passo, de 0 a 1, sempre na grade de 5%. */
export function proximoVolume(atual: number, direcao: 1 | -1) {
  const passos = Math.round(atual / PASSO) + direcao;
  return Math.min(1, Math.max(0, Math.round(passos * PASSO * 100) / 100));
}

export interface EstadoDoVolume {
  volume: number;
  /** Quantas vezes o atalho mudou o volume (0 = nunca): cada mudança faz o indicador aparecer. */
  peloAtalho: number;
}

let estadoAtual: EstadoDoVolume = { volume: 1, peloAtalho: 0 };
const ouvintes = new Set<() => void>();
let mestre: GainNode | null = null;
let contextoDoMestre: AudioContext | null = null;

/** O volume geral do jogo, para a tela acompanhar com `useSyncExternalStore`. */
export const volumeGeral = {
  inscrever(ouvinte: () => void) {
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  },
  estado: () => estadoAtual,
};

function mudar(volume: number, peloAtalho: boolean) {
  estadoAtual = { volume, peloAtalho: estadoAtual.peloAtalho + (peloAtalho ? 1 : 0) };
  if (mestre && contextoDoMestre) mestre.gain.setTargetAtTime(volume, contextoDoMestre.currentTime, SUAVIZACAO);
  for (const ouvinte of ouvintes) ouvinte();
}

export const definirVolumeGeral = (volume: number) => mudar(Math.min(1, Math.max(0, volume)), false);
export const lerVolumeGeral = () => estadoAtual.volume;

/**
 * Onde todo som do jogo se liga, no lugar de `contexto.destination`: um ganho mestre
 * com o volume geral. Assim um controle só vale para o menu, a partida e os efeitos.
 */
export function saidaDeAudio(contexto: AudioContext = obterContextoDeAudio()): AudioNode {
  if (!mestre || contextoDoMestre !== contexto) {
    contextoDoMestre = contexto;
    mestre = contexto.createGain();
    mestre.gain.value = estadoAtual.volume;
    mestre.connect(contexto.destination);
  }
  return mestre;
}

const ehCampoDeTexto = (alvo: EventTarget | null) =>
  alvo instanceof HTMLElement && (alvo.isContentEditable || alvo.tagName === "TEXTAREA" || (alvo.tagName === "INPUT" && (alvo as HTMLInputElement).type !== "range"));

/**
 * Atalhos de volume em qualquer tela, como no osu!: Alt + roda (o do osu!), Ctrl + roda
 * (sem deixar o navegador dar zoom) e Ctrl + ↑/↓ para quem não tem mouse.
 * Instale antes de as telas existirem: os ouvintes de captura na janela rodam na ordem em que
 * foram registrados, e o Ctrl + ↑/↓ precisa ser parado antes de chegar no menu.
 */
export function instalarAtalhosDeVolume(janela: Window = window) {
  // Mexeu no volume com o Alt: soltar o Alt não pode abrir a barra de menu do navegador.
  let altUsado = false;

  const aoRodar = (evento: WheelEvent) => {
    if (!evento.altKey && !evento.ctrlKey) return;
    evento.preventDefault();
    evento.stopPropagation();
    // Com o Shift junto, alguns navegadores mandam a roda no eixo X.
    const delta = evento.deltaY || evento.deltaX;
    if (!delta) return;
    if (evento.altKey) altUsado = true;
    mudar(proximoVolume(estadoAtual.volume, delta < 0 ? 1 : -1), true);
  };

  const aoApertar = (evento: KeyboardEvent) => {
    if (evento.key === "Alt") altUsado = false;
    const seta = evento.code === "ArrowUp" ? 1 : evento.code === "ArrowDown" ? -1 : 0;
    if (!seta || !evento.ctrlKey || evento.altKey || evento.shiftKey || evento.metaKey || ehCampoDeTexto(evento.target)) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    mudar(proximoVolume(estadoAtual.volume, seta), true);
  };

  const aoSoltar = (evento: KeyboardEvent) => {
    if (evento.key !== "Alt" || !altUsado) return;
    altUsado = false;
    evento.preventDefault();
  };

  // A janela perdeu o foco no meio do gesto: o próximo Alt começa do zero.
  const aoPerderFoco = () => (altUsado = false);

  janela.addEventListener("wheel", aoRodar, { capture: true, passive: false });
  janela.addEventListener("keydown", aoApertar, { capture: true });
  janela.addEventListener("keyup", aoSoltar, { capture: true });
  janela.addEventListener("blur", aoPerderFoco);
  return () => {
    janela.removeEventListener("wheel", aoRodar, { capture: true });
    janela.removeEventListener("keydown", aoApertar, { capture: true });
    janela.removeEventListener("keyup", aoSoltar, { capture: true });
    janela.removeEventListener("blur", aoPerderFoco);
  };
}
