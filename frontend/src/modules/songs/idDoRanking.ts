import type { Musica } from "./tipos";

/** Como a música é reconhecida no ranking: o mesmo chart precisa ter o mesmo id em qualquer aparelho. */
export const idDoRanking = (musica: Pick<Musica, "id" | "md5DoEncore">) => (musica.md5DoEncore ? `encore:${musica.md5DoEncore}` : musica.id);

/** "Título — Artista" da música com esse id do ranking, se ela estiver na lista. */
export function tituloDaMusica(musicas: Pick<Musica, "id" | "md5DoEncore" | "titulo" | "artista">[], id: string) {
  const musica = musicas.find((m) => idDoRanking(m) === id);
  if (!musica) return undefined;
  return musica.artista ? `${musica.titulo} — ${musica.artista}` : musica.titulo;
}
