import { useEffect } from "react";
import type { FaixaDoPlayer, PlayerDeMusica } from "./playerDeMusica";

/** Passando rápido pelo carrossel, o player não carrega cada música do caminho. */
export const ESPERA_PARA_SEGUIR_MS = 300;

/** Faz o player tocar o mapa escolhido na tela, depois que a escolha fica parada um instante. */
export function useSeguirMapa<F extends FaixaDoPlayer>(player: PlayerDeMusica<F>, faixa: F | null) {
  useEffect(() => {
    if (!faixa) return;
    const espera = setTimeout(() => player.seguirMapa(faixa), ESPERA_PARA_SEGUIR_MS);
    return () => clearTimeout(espera);
  }, [player, faixa]);
}
