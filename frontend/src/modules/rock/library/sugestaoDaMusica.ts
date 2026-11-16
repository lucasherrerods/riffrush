import type { SugestaoDeMusica } from "@/modules/presenca";
import { DIFICULDADES, INSTRUMENTOS, type Dificuldade, type Instrumento, type Musica } from "@/modules/rock/songs";

/** A música do Rock como sugestão para um amigo. Só os charts do Encore: o amigo baixa pelo md5. */
export function sugestaoDaMusica(musica: Musica, dificuldade: Dificuldade, instrumento: Instrumento): SugestaoDeMusica | null {
  if (!musica.md5DoEncore) return null;
  const rotulo = (lista: { id: string; rotulo: string }[], id: string) => lista.find((item) => item.id === id)?.rotulo ?? id;
  return {
    modo: "rock",
    musica: musica.md5DoEncore,
    versao: dificuldade,
    titulo: musica.titulo,
    artista: musica.artista,
    dificuldade: `${rotulo(DIFICULDADES, dificuldade)} · ${rotulo(INSTRUMENTOS, instrumento)}`,
  };
}
