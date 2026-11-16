import type { SugestaoDeMusica } from "@/modules/presenca";
import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";

/** O mapa do Mania como sugestão para um amigo. Só os que vieram do osu!: o amigo baixa pelo id do conjunto. */
export function sugestaoDoConjunto(conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva | undefined): SugestaoDeMusica | null {
  if (conjunto.origem !== "osu" || !conjunto.beatmapsetId) return null;
  return {
    modo: "mania",
    musica: String(conjunto.beatmapsetId),
    versao: dificuldade?.beatmapId ? String(dificuldade.beatmapId) : null,
    titulo: conjunto.tituloUnicode || conjunto.titulo,
    artista: conjunto.artistaUnicode || conjunto.artista,
    dificuldade: dificuldade ? `[${dificuldade.dificuldade}] ${dificuldade.teclas}K` : "",
  };
}
