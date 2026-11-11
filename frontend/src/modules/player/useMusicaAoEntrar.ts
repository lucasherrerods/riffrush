import { useState } from "react";
import type { FaixaDoPlayer, PlayerDeMusica } from "./playerDeMusica";

/**
 * A seleção abre na música que está tocando, para entrar nela nunca trocar a música.
 * Avisa ainda no render de entrada, para a tela já nascer nela, sem o carrossel rolar desde a antiga.
 * `aoEntrar` deve só mudar estado do componente que chama o hook.
 */
export function useMusicaAoEntrar<F extends FaixaDoPlayer>(player: PlayerDeMusica<F>, dentro: boolean, aoEntrar: (id: string) => void) {
  const [estavaDentro, setEstavaDentro] = useState(false);
  if (dentro !== estavaDentro) {
    setEstavaDentro(dentro);
    const id = dentro && player.estado().musica?.id;
    if (id) aoEntrar(id);
  }
}
