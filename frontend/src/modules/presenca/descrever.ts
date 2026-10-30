import { DIFICULDADES, INSTRUMENTOS } from "@/modules/rock/songs";
import type { EstadoOnline } from "./protocolo";

/** Onde a pessoa está, em texto para as listas. */
export function descreverEstado(estado: EstadoOnline) {
  if (estado.tipo === "menu") return "No menu";
  if (estado.tipo === "selecao") return "Escolhendo música";
  if (estado.tipo === "multiplayer") {
    if (!estado.sala) return "No multiplayer";
    const { online, jogadores } = estado.sala;
    return `Em sala ${online ? "online" : "na LAN"} · ${jogadores} ${jogadores === 1 ? "jogador" : "jogadores"}`;
  }
  const dificuldade = DIFICULDADES.find((d) => d.id === estado.dificuldade)?.rotulo ?? estado.dificuldade;
  const instrumento = estado.instrumento === "guitarra" ? "" : ` · ${INSTRUMENTOS.find((i) => i.id === estado.instrumento)?.rotulo ?? estado.instrumento}`;
  return `Tocando ${estado.titulo} – ${estado.artista} · ${dificuldade}${instrumento}`;
}
