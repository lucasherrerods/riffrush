import { useSyncExternalStore } from "react";

/** O último aparelho que o jogador usou: as dicas de comandos mostram as teclas ou os botões dele. */
export type Dispositivo = "teclado" | "controle";
export type Comando = "horizontal" | "vertical" | "confirmar" | "voltar" | "instrumento";

const ROTULOS: Record<Dispositivo, Record<Comando, string>> = {
  teclado: { horizontal: "← →", vertical: "↑ ↓", confirmar: "Enter", voltar: "Esc", instrumento: "Tab" },
  controle: { horizontal: "✚ ◀ ▶", vertical: "✚ ▲ ▼", confirmar: "A", voltar: "B", instrumento: "Y" },
};

export const rotuloDoComando = (comando: Comando, dispositivo: Dispositivo) => ROTULOS[dispositivo][comando];

let atual: Dispositivo = "teclado";
const ouvintes = new Set<() => void>();
/** O controle vira teclas simuladas; essas não podem trazer as dicas de volta para o teclado. Guarda o índice do controle de cada uma. */
const doControle = new WeakMap<Event, number>();

export function marcarComoDoControle(evento: Event, indice = 0) {
  doControle.set(evento, indice);
}

/** O evento é uma tecla simulada pelo controle, e não do teclado. */
export const veioDoControle = (evento: Event) => doControle.has(evento);

/** O índice (`Gamepad.index`) do controle que simulou a tecla; no teclado, nada. */
export const indiceDoControle = (evento: Event) => doControle.get(evento);

export function registrarUso(dispositivo: Dispositivo) {
  if (dispositivo === atual) return;
  atual = dispositivo;
  for (const ouvinte of ouvintes) ouvinte();
}

export const dispositivoAtual = () => atual;

const aoTeclar = (evento: KeyboardEvent) => {
  if (!doControle.has(evento)) registrarUso("teclado");
};

function inscrever(ouvinte: () => void) {
  if (!ouvintes.size) window.addEventListener("keydown", aoTeclar, true);
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
    if (!ouvintes.size) window.removeEventListener("keydown", aoTeclar, true);
  };
}

export function useDispositivo() {
  return useSyncExternalStore(inscrever, dispositivoAtual);
}
