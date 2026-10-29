import { useEffect } from "react";
import type { Musica } from "@/modules/rock/songs";
import { playerDeMusica } from "./playerDeMusica";

/** Passando rápido pelo carrossel, o player não carrega cada música do caminho. */
export const ESPERA_PARA_SEGUIR_MS = 300;

/** Faz o player tocar a música que a tela pede, depois que o pedido fica parado um instante. */
export function useSeguirMusica(musica: Musica | null) {
  useEffect(() => {
    if (!musica) return;
    const espera = setTimeout(() => playerDeMusica.seguir(musica), ESPERA_PARA_SEGUIR_MS);
    return () => clearTimeout(espera);
  }, [musica]);
}
