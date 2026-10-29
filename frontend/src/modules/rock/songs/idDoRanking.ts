import type { Musica } from "./tipos";

/** Como a música é reconhecida no ranking: o mesmo chart precisa ter o mesmo id em qualquer aparelho. */
export const idDoRanking = (musica: Pick<Musica, "id" | "md5DoEncore">) => (musica.md5DoEncore ? `encore:${musica.md5DoEncore}` : musica.id);

/** "Título — Artista" da música com esse id do ranking, se ela estiver na lista. */
export function tituloDaMusica(musicas: Pick<Musica, "id" | "md5DoEncore" | "titulo" | "artista">[], id: string) {
  const musica = musicas.find((m) => idDoRanking(m) === id);
  if (!musica) return undefined;
  return musica.artista ? `${musica.titulo} — ${musica.artista}` : musica.titulo;
}

/** O que a API sabe de uma música (do Encore ou do nome do arquivo). */
export interface MusicaDaApi {
  musica_id: string;
  titulo?: string | null;
  artista?: string | null;
}

/** O nome para mostrar: a biblioteca primeiro (músicas do jogo), depois o que a API achou, e por último o id. */
export function nomeDaMusica(musica: MusicaDaApi, daBiblioteca: (id: string) => string | undefined) {
  const daApi = musica.titulo && (musica.artista ? `${musica.titulo} — ${musica.artista}` : musica.titulo);
  return daBiblioteca(musica.musica_id) ?? (daApi || undefined) ?? musica.musica_id;
}
