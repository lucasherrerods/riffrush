import type { FiltrosDaBusca, MapaDaBusca, PaginaDaBusca } from "./api";

/** Quantas páginas de mapas ranked o sorteio considera; a busca do osu! não diz o total. */
export const PAGINAS_DO_SORTEIO = 10;

interface Opcoes {
  buscar: (filtros: FiltrosDaBusca) => Promise<PaginaDaBusca>;
  /** Os conjuntos que já estão na biblioteca, pelo beatmapset_id: o sorteio traz um novo. */
  baixados: Set<number>;
  aleatorio?: () => number;
}

/** Sorteia um mapa ranked que ainda não está na biblioteca, só com as teclas pedidas quando há filtro. */
export async function sortearMapa(teclas: number | "todas", { buscar, baixados, aleatorio = Math.random }: Opcoes): Promise<MapaDaBusca> {
  const filtros: FiltrosDaBusca = { texto: "", status: "ranked", teclas: teclas === "todas" ? [] : [teclas] };
  const novos = (pagina: PaginaDaBusca) => pagina.mapas.filter((m) => !baixados.has(m.beatmapsetId));
  const pagina = Math.floor(aleatorio() * PAGINAS_DO_SORTEIO);
  let lista = novos(await buscar({ ...filtros, pagina }));
  // Uma página alta pode vir vazia (poucos mapas com essas teclas): a primeira sempre tem.
  if (!lista.length && pagina !== 0) lista = novos(await buscar({ ...filtros, pagina: 0 }));
  if (!lista.length) throw new Error("Nenhum mapa novo para sortear com esse filtro.");
  return lista[Math.floor(aleatorio() * lista.length)];
}
