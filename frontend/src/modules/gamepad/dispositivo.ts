import { useSyncExternalStore } from "react";

/** O último aparelho que o jogador usou: as dicas de comandos mostram as teclas ou os botões dele. */
export type Dispositivo = "teclado" | "controle";
export type Comando = "horizontal" | "vertical" | "confirmar" | "voltar";

const ROTULOS: Record<Dispositivo, Record<Comando, string>> = {
  teclado: { horizontal: "← →", vertical: "↑ ↓", confirmar: "Enter", voltar: "Esc" },
  controle: { horizontal: "✚ ◀ ▶", vertical: "✚ ▲ ▼", confirmar: "A", voltar: "B" },
};

export const rotuloDoComando = (comando: Comando, dispositivo: Dispositivo) => ROTULOS[dispositivo][comando];

let atual: Dispositivo = "teclado";
const ouvintes = new Set<() => void>();
/** O controle vira teclas simuladas; essas não podem trazer as dicas de volta para o teclado. */
const doControle = new WeakSet<Event>();

export function marcarComoDoControle(evento: Event) {
  doControle.add(evento);
}

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
