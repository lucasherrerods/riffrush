import type { ConjuntoSalvo } from "../beatmaps/biblioteca";

export type OrdemDaSelecao = "recentes" | "titulo" | "artista" | "estrelas";

export interface FiltroDaSelecao {
  texto: string;
  /** Só as dificuldades com essas teclas, ou todas. */
  teclas: number | "todas";
  ordem: OrdemDaSelecao;
}

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const titulo = (c: ConjuntoSalvo) => c.tituloUnicode || c.titulo;
const artista = (c: ConjuntoSalvo) => c.artistaUnicode || c.artista;

/** A estrela da dificuldade mais difícil do conjunto, quando a busca do osu! as trouxe. */
export function maiorEstrela(conjunto: ConjuntoSalvo): number | undefined {
  const estrelas = conjunto.mapas.flatMap((m) => (conjunto.estrelas?.[m.hash] !== undefined ? [conjunto.estrelas[m.hash]] : []));
  return estrelas.length ? Math.max(...estrelas) : undefined;
}

/** As teclas que aparecem em algum mapa da biblioteca, para o filtro só oferecer as que existem. */
export function teclasDaBiblioteca(conjuntos: ConjuntoSalvo[]): number[] {
  return [...new Set(conjuntos.flatMap((c) => c.mapas.map((m) => m.teclas)))].sort((a, b) => a - b);
}

const comparar = (ordem: OrdemDaSelecao) => (a: ConjuntoSalvo, b: ConjuntoSalvo) => {
  if (ordem === "titulo") return titulo(a).localeCompare(titulo(b), "pt-BR", { sensitivity: "base" });
  if (ordem === "artista") return artista(a).localeCompare(artista(b), "pt-BR", { sensitivity: "base" });
  if (ordem === "estrelas") return (maiorEstrela(b) ?? -1) - (maiorEstrela(a) ?? -1);
  return 0;
};

/** Os conjuntos que aparecem na roda: busca por texto, filtro de teclas (que também esconde as outras dificuldades) e ordem. */
export function filtrarConjuntos(conjuntos: ConjuntoSalvo[], { texto, teclas, ordem }: FiltroDaSelecao): ConjuntoSalvo[] {
  const busca = normalizar(texto);
  return conjuntos
    .map((c) => (teclas === "todas" ? c : { ...c, mapas: c.mapas.filter((m) => m.teclas === teclas) }))
    .filter((c) => c.mapas.length)
    .filter((c) => !busca || normalizar([c.titulo, c.tituloUnicode, c.artista, c.artistaUnicode, c.mapper, ...c.mapas.map((m) => m.dificuldade)].join(" ")).includes(busca))
    .sort(comparar(ordem));
}
