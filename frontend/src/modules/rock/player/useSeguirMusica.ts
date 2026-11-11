import { useSeguirMapa } from "@/modules/player";
import type { Musica } from "@/modules/rock/songs";
import { playerDeMusica } from "./playerDeMusica";

/** Faz o player do Rock tocar a música que a tela pede. */
export const useSeguirMusica = (musica: Musica | null, opcoes?: Parameters<typeof useSeguirMapa>[2]) => useSeguirMapa(playerDeMusica, musica, opcoes);
