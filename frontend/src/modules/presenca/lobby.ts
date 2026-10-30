import { filtrarPorNome } from "@/shared/lib/busca";
import type { EstadoOnline, PessoaOnline } from "./protocolo";

export type GrupoDoLobby = "tocando" | "sala" | "menu";
export type FiltroDoLobby = "todos" | GrupoDoLobby;

export const FILTROS_DO_LOBBY: { id: FiltroDoLobby; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "tocando", rotulo: "Tocando" },
  { id: "sala", rotulo: "Em sala" },
  { id: "menu", rotulo: "No menu" },
];

/** Só a partida de quem deixou assistir chega a quem quer ver. */
export const podeAssistir = (estado: EstadoOnline) => estado.tipo === "tocando" && estado.transmitindo;

export function grupoDoEstado(estado: EstadoOnline): GrupoDoLobby {
  if (estado.tipo === "tocando") return "tocando";
  if (estado.tipo === "multiplayer" && estado.sala) return "sala";
  return "menu";
}

export function contarGrupos(pessoas: PessoaOnline[]): Record<FiltroDoLobby, number> {
  const contagem = { todos: pessoas.length, tocando: 0, sala: 0, menu: 0 };
  for (const pessoa of pessoas) contagem[grupoDoEstado(pessoa.estado)]++;
  return contagem;
}

export function filtrarLobby(pessoas: PessoaOnline[], filtro: FiltroDoLobby, busca: string): PessoaOnline[] {
  const doGrupo = filtro === "todos" ? pessoas : pessoas.filter((p) => grupoDoEstado(p.estado) === filtro);
  return filtrarPorNome(doGrupo, busca);
}

/** Os amigos sobem para o topo; dentro de cada parte, a ordem que já veio continua. */
export function amigosPrimeiro(pessoas: PessoaOnline[], amigos: ReadonlySet<string>): PessoaOnline[] {
  return [...pessoas.filter((p) => amigos.has(p.id)), ...pessoas.filter((p) => !amigos.has(p.id))];
}
