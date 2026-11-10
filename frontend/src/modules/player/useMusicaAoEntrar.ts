import { useEffect, useRef } from "react";
import type { FaixaDoPlayer, PlayerDeMusica } from "./playerDeMusica";

/**
 * A seleção abre na música que está tocando, para entrar nela nunca trocar a música.
 * Chame depois de `useTrilhaDaPartida`, para já pegar a música da partida que acabou.
 */
export function useMusicaAoEntrar<F extends FaixaDoPlayer>(player: PlayerDeMusica<F>, dentro: boolean, aoEntrar: (id: string) => void) {
  const avisar = useRef(aoEntrar);
  avisar.current = aoEntrar;
  useEffect(() => {
    const id = dentro && player.estado().musica?.id;
    if (id) avisar.current(id);
  }, [player, dentro]);
}
