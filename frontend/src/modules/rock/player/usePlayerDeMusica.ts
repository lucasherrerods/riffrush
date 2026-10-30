import { useEffect, useState, useSyncExternalStore } from "react";
import { playerDeMusica } from "./playerDeMusica";

export function usePlayerDeMusica() {
  return useSyncExternalStore(playerDeMusica.inscrever, playerDeMusica.estado);
}

/** O tempo e a barra do cabeçalho: 4 vezes por segundo basta, e não re-renderiza o cabeçalho a cada quadro nos menus. */
export const INTERVALO_DA_POSICAO_MS = 250;

/** A posição muda o tempo todo; só quem mostra o tempo se atualiza por ela. */
export function usePosicaoDaMusica(tocando: boolean) {
  const [posicao, setPosicao] = useState(() => playerDeMusica.posicao());
  useEffect(() => {
    setPosicao(playerDeMusica.posicao());
    if (!tocando) return playerDeMusica.inscrever(() => setPosicao(playerDeMusica.posicao()));
    const relogio = setInterval(() => setPosicao(playerDeMusica.posicao()), INTERVALO_DA_POSICAO_MS);
    return () => clearInterval(relogio);
  }, [tocando]);
  return posicao;
}
