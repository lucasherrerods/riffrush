import { obterContextoDeAudio } from "@/modules/audio";
import { PlayerDeMusica } from "@/modules/player";
import { carregarMusica, type Musica } from "@/modules/rock/songs";

/** A trilha dos menus do Rock: toca as músicas do jogo, seguindo a que cada tela pede. */
export const playerDeMusica = new PlayerDeMusica<Musica>(obterContextoDeAudio, async (musica) => (await carregarMusica(musica, "medio")).audio);
