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

/** Depois de soltar o Alt sozinho, o Windows pode tirar o foco da janela (modo menu) por este tempo. */
const JANELA_DO_ALT_MS = 500;
let altSoltoEm = -Infinity;

/**
 * O foco acabou de sair por causa do Alt solto sozinho (o modo menu da janela no Windows),
 * e não porque a pessoa trocou de janela. No Alt+Tab o foco sai com o Alt ainda segurado.
 */
export const focoSaiuPeloAlt = (agora = performance.now()) => agora - altSoltoEm < JANELA_DO_ALT_MS;

/**
 * Alt + roda muda o volume em qualquer tela, como no osu!. Instale antes de as telas existirem:
 * o atalho é ouvido na captura da janela e não chega nas telas.
 *
 * O jogo não usa o Alt sozinho, então o padrão dele é sempre bloqueado: soltar o Alt não abre a
 * barra de menu do navegador nem põe a janela em modo menu (que tiraria o foco e pausaria a partida).
 * Alt+Tab e Alt+F4 continuam valendo: quem trata esses é o sistema.
 */
export function instalarAtalhosDeVolume(janela: Window = window) {

  const aoRodar = (evento: WheelEvent) => {
    if (!evento.altKey) return;
    evento.preventDefault();
    evento.stopPropagation();
    // Com o Shift junto, alguns navegadores mandam a roda no eixo X.
    const delta = evento.deltaY || evento.deltaX;
    if (!delta) return;
    mudar(proximoVolume(estadoAtual.volume, delta < 0 ? 1 : -1), true);
  };

  const aoApertar = (evento: KeyboardEvent) => {
    // Outra tecla depois do Alt: o foco que sair agora não é mais culpa do Alt.
    altSoltoEm = -Infinity;
    if (evento.key === "Alt") evento.preventDefault();
  };

  const aoSoltar = (evento: KeyboardEvent) => {
    if (evento.key !== "Alt") return;
    evento.preventDefault();
    altSoltoEm = performance.now();
  };

  // A janela voltou: o próximo foco perdido começa do zero.
  const aoVoltarOFoco = () => (altSoltoEm = -Infinity);

  janela.addEventListener("wheel", aoRodar, { capture: true, passive: false });
  janela.addEventListener("keydown", aoApertar, { capture: true });
  janela.addEventListener("keyup", aoSoltar, { capture: true });
  janela.addEventListener("focus", aoVoltarOFoco);
  return () => {
    janela.removeEventListener("wheel", aoRodar, { capture: true });
    janela.removeEventListener("keydown", aoApertar, { capture: true });
    janela.removeEventListener("keyup", aoSoltar, { capture: true });
    janela.removeEventListener("focus", aoVoltarOFoco);
  };
}
