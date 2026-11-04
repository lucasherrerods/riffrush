import { useEffect, useState, useSyncExternalStore } from "react";
import type { FaixaDoPlayer, PlayerDeMusica } from "./playerDeMusica";

export function usePlayerDeMusica<F extends FaixaDoPlayer>(player: PlayerDeMusica<F>) {
  return useSyncExternalStore(player.inscrever, player.estado);
}

/** O tempo e a barra do cabeçalho: 4 vezes por segundo basta, e não re-renderiza o cabeçalho a cada quadro nos menus. */
export const INTERVALO_DA_POSICAO_MS = 250;

/** A posição muda o tempo todo; só quem mostra o tempo se atualiza por ela. */
export function usePosicaoDaMusica<F extends FaixaDoPlayer>(tocando: boolean, player: PlayerDeMusica<F>) {
  const [posicao, setPosicao] = useState(() => player.posicao());
  useEffect(() => {
    setPosicao(player.posicao());
    if (!tocando) return player.inscrever(() => setPosicao(player.posicao()));
    const relogio = setInterval(() => setPosicao(player.posicao()), INTERVALO_DA_POSICAO_MS);
    return () => clearInterval(relogio);
  }, [tocando, player]);
  return posicao;
}
