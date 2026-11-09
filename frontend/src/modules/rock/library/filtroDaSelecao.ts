import { semAcento } from "@/shared/lib/busca";
import type { Musica } from "@/modules/rock/songs";

export type OrdemDaSelecao = "biblioteca" | "titulo" | "artista";

export interface FiltroDaSelecao {
  texto: string;
  ordem: OrdemDaSelecao;
  favoritas: Set<string>;
  soFavoritas: boolean;
}

const comparar = (ordem: OrdemDaSelecao) => (a: Musica, b: Musica) => {
  if (ordem === "titulo") return a.titulo.localeCompare(b.titulo, "pt-BR", { sensitivity: "base" });
  if (ordem === "artista") return a.artista.localeCompare(b.artista, "pt-BR", { sensitivity: "base" });
  return 0;
};

/** As posições das músicas que aparecem na roda, na ordem em que aparecem: busca por título, artista ou gênero, favoritas e ordem. */
export function filtrarMusicas(musicas: Musica[], { texto, ordem, favoritas, soFavoritas }: FiltroDaSelecao): number[] {
  const busca = semAcento(texto);
  return musicas
    .map((musica, indice) => ({ musica, indice }))
    .filter(({ musica }) => !soFavoritas || favoritas.has(musica.id))
    .filter(({ musica }) => !busca || semAcento([musica.titulo, musica.artista, musica.genero].join(" ")).includes(busca))
    .sort((a, b) => comparar(ordem)(a.musica, b.musica))
    .map(({ indice }) => indice);
}
