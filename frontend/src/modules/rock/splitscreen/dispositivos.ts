import { indiceDoControle, veioDoControle } from "@/modules/gamepad";
import type { OpcoesDaPartida } from "@/modules/rock/gameplay";

export const MAXIMO_DE_JOGADORES = 4;

/** Dois jogadores podem dividir o teclado: um em cada metade. */
export type LadoDoTeclado = "esquerda" | "direita";
export type DispositivoDoJogador = { tipo: "teclado"; lado: LadoDoTeclado } | { tipo: "controle"; indice: number };

export interface LayoutDoTeclado {
  /** Verde, vermelho, amarelo, azul, laranja e a nota aberta, como em `OpcoesDaPartida.teclas`. */
  teclas: string[];
  teclaDaEstrela: string;
  rotuloDaTeclaDaEstrela: string;
  teclaDaPalheta: string;
}

export const LAYOUTS_DO_TECLADO: Record<LadoDoTeclado, LayoutDoTeclado> = {
  esquerda: { teclas: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyV"], teclaDaEstrela: "KeyQ", rotuloDaTeclaDaEstrela: "Q", teclaDaPalheta: "KeyB" },
  direita: { teclas: ["KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "KeyN"], teclaDaEstrela: "KeyP", rotuloDaTeclaDaEstrela: "P", teclaDaPalheta: "KeyM" },
};

const LADOS = Object.keys(LAYOUTS_DO_TECLADO) as LadoDoTeclado[];
const teclasDoLado = (lado: LadoDoTeclado) => {
  const layout = LAYOUTS_DO_TECLADO[lado];
  return [...layout.teclas, layout.teclaDaEstrela, layout.teclaDaPalheta];
};

export const mesmoDispositivo = (a: DispositivoDoJogador, b: DispositivoDoJogador) =>
  a.tipo === "teclado" ? b.tipo === "teclado" && a.lado === b.lado : b.tipo === "controle" && a.indice === b.indice;

/** As teclas do controle são simuladas e marcadas com o índice dele: assim cada pista ouve só o seu jogador. */
export function eventoDoJogador(evento: Event, dispositivo: DispositivoDoJogador) {
  if (dispositivo.tipo === "teclado") return !veioDoControle(evento);
  return indiceDoControle(evento) === dispositivo.indice;
}

/** No teclado valem as teclas do lado; no controle, o mapeamento das configurações, que é o que o controle simula. */
export function opcoesDoJogador(opcoes: OpcoesDaPartida, dispositivo: DispositivoDoJogador): OpcoesDaPartida {
  if (dispositivo.tipo === "controle") return opcoes;
  return { ...opcoes, ...LAYOUTS_DO_TECLADO[dispositivo.lado], rotulosDosTrastes: undefined };
}

/** Na escolha de dispositivos, o jogador entra apertando uma tecla do seu lado ou qualquer botão do controle. */
export function dispositivoDaTecla(evento: KeyboardEvent): DispositivoDoJogador | null {
  const indice = indiceDoControle(evento);
  if (indice !== undefined) return { tipo: "controle", indice };
  const lado = LADOS.find((l) => teclasDoLado(l).includes(evento.code));
  return lado ? { tipo: "teclado", lado } : null;
}

export function entrar(jogadores: DispositivoDoJogador[], dispositivo: DispositivoDoJogador) {
  if (jogadores.length >= MAXIMO_DE_JOGADORES || jogadores.some((j) => mesmoDispositivo(j, dispositivo))) return jogadores;
  return [...jogadores, dispositivo];
}

export const sair = (jogadores: DispositivoDoJogador[], dispositivo: DispositivoDoJogador) => jogadores.filter((j) => !mesmoDispositivo(j, dispositivo));

/** Teclados comuns registram poucas teclas ao mesmo tempo: com duas pessoas no mesmo, acordes podem se perder. */
export const avisoDeRollover = (jogadores: DispositivoDoJogador[]) => jogadores.filter((j) => j.tipo === "teclado").length >= 2;
