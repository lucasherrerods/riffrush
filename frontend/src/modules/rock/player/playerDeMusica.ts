import { obterContextoDeAudio } from "@/modules/audio";
import { PlayerDeMusica } from "@/modules/player";
import { carregarAudioDaMusica, type Musica } from "@/modules/rock/songs";

/** A trilha dos menus do Rock: toca as músicas do jogo, seguindo a que cada tela pede. */
export const playerDeMusica = new PlayerDeMusica<Musica>(obterContextoDeAudio, carregarAudioDaMusica);
