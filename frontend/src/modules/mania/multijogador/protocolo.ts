import { criarProtocolo, type EstadoDaSalaEmRede, type JogadaNaSala, type PerfilNaSala } from "@/modules/multiplayer";

/**
 * Como um mapa viaja na sala: os do osu! pelo id do conjunto, que cada jogador baixa sozinho,
 * e os importados (só na LAN) pelo .osz que o host compartilha. O `hash` é o da dificuldade.
 */
export type MapaNaRede =
  | { tipo: "osu"; beatmapsetId: number; hash: string; titulo: string; artista: string; dificuldade: string; teclas: number; /** Ranked, loved...: o convidado guarda junto, para a partida valer XP. A API confere. */ status?: string }
  | { tipo: "importado"; hash: string; titulo: string; artista: string; dificuldade: string; teclas: number };

/** O host escolhe o mapa e os mods, e todos jogam igual, para a pontuação ser comparável. */
export interface EscolhaDoMania {
  mapa: MapaNaRede | null;
  mods: number;
}

type EscolhaNaRede = { modo?: unknown; mapa?: unknown; mods?: unknown };

/** O placar ao vivo de cada jogador. */
export interface JogadaDoMania extends JogadaNaSala {
  precisao: number;
  combo: number;
  derrota: boolean;
}

export type PerfilDoMania = PerfilNaSala;

const TEXTO_MAXIMO = 200;
const texto = (valor: unknown): valor is string => typeof valor === "string" && valor.length <= TEXTO_MAXIMO;
const inteiroEntre = (valor: unknown, minimo: number, maximo: number): valor is number => Number.isInteger(valor) && (valor as number) >= minimo && (valor as number) <= maximo;

function lerMapa(valor: unknown): MapaNaRede | null | undefined {
  if (valor === null) return null;
  if (typeof valor !== "object") return undefined;
  const m = valor as Record<string, unknown>;
  if (!texto(m.hash) || !m.hash || !texto(m.titulo) || !texto(m.artista) || !texto(m.dificuldade) || !inteiroEntre(m.teclas, 1, 18)) return undefined;
  const comum = { hash: m.hash, titulo: m.titulo, artista: m.artista, dificuldade: m.dificuldade, teclas: m.teclas };
  if (m.tipo === "importado") return { tipo: "importado", ...comum };
  if (m.tipo === "osu" && inteiroEntre(m.beatmapsetId, 1, 2 ** 31 - 1)) return { tipo: "osu", beatmapsetId: m.beatmapsetId, ...comum, ...(texto(m.status) && m.status.length <= 20 && { status: m.status }) };
  return undefined;
}

/** O que chega da rede vem de outro cliente: só passa a escolha com a forma certa. */
export function lerEscolhaDoMania({ modo, mapa, mods }: EscolhaNaRede): EscolhaDoMania | null {
  if (modo !== "mania" || !inteiroEntre(mods, 0, 2 ** 30)) return null;
  const lido = lerMapa(mapa);
  return lido === undefined ? null : { mapa: lido, mods };
}

export const protocoloDoMania = criarProtocolo<EscolhaDoMania, EscolhaNaRede, PerfilDoMania, JogadaDoMania>({
  nome: "Mania",
  escolhaInicial: { mapa: null, mods: 0 },
  idDaEscolha: (escolha) => escolha.mapa?.hash ?? "",
  escreverEscolha: (escolha) => ({ modo: "mania", ...escolha }),
  lerEscolha: lerEscolhaDoMania,
});

export type EstadoDaSalaDoMania = EstadoDaSalaEmRede<EscolhaDoMania, PerfilDoMania, JogadaDoMania>;
