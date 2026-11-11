import { faixaDasEstrelas, type FaixaDeDificuldade } from "../beatmaps/dificuldades";
import type { FiltrosDaBusca, MapaDaBusca, PaginaDaBusca } from "./api";

/** Quantas páginas de mapas ranked o sorteio considera; a busca do osu! não diz o total. */
export const PAGINAS_DO_SORTEIO = 10;

/** O que a Aleatória aceita sortear. Lista vazia é qualquer uma. */
export interface FiltroDoSorteio {
  teclas: number[];
  faixas: FaixaDeDificuldade[];
}

interface Opcoes {
  buscar: (filtros: FiltrosDaBusca) => Promise<PaginaDaBusca>;
  /** Os conjuntos que já estão na biblioteca, pelo beatmapset_id: o sorteio traz um novo. */
  baixados: Set<number>;
  aleatorio?: () => number;
}

/** O mapa serve se uma mesma dificuldade dele tem as teclas e a faixa pedidas. */
export function mapaNoFiltro(mapa: MapaDaBusca, { teclas, faixas }: FiltroDoSorteio) {
  return mapa.dificuldades.some(
    (d) => (!teclas.length || teclas.includes(d.teclas)) && (!faixas.length || faixas.includes(faixaDasEstrelas(d.estrelas))),
  );
}

/** Sorteia um mapa ranked que ainda não está na biblioteca e passa no filtro. */
export async function sortearMapa(filtro: FiltroDoSorteio, { buscar, baixados, aleatorio = Math.random }: Opcoes): Promise<MapaDaBusca> {
  const filtros: FiltrosDaBusca = { texto: "", status: "ranked", teclas: filtro.teclas };
  const novos = (pagina: PaginaDaBusca) => pagina.mapas.filter((m) => !baixados.has(m.beatmapsetId) && mapaNoFiltro(m, filtro));
  const pagina = Math.floor(aleatorio() * PAGINAS_DO_SORTEIO);
  let lista = novos(await buscar({ ...filtros, pagina }));
  // Uma página alta pode vir vazia (poucos mapas com esse filtro): a primeira é a mais cheia.
  if (!lista.length && pagina !== 0) lista = novos(await buscar({ ...filtros, pagina: 0 }));
  if (!lista.length) throw new Error("Nenhum mapa novo para sortear com esse filtro.");
  return lista[Math.floor(aleatorio() * lista.length)];
}
