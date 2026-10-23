import { useEffect, useState, useSyncExternalStore } from "react";
import { playerDeMusica } from "./playerDeMusica";

export function usePlayerDeMusica() {
  return useSyncExternalStore(playerDeMusica.inscrever, playerDeMusica.estado);
}

/** A posição muda a todo quadro; só quem mostra o tempo se atualiza por ela. */
export function usePosicaoDaMusica(tocando: boolean) {
  const [posicao, setPosicao] = useState(() => playerDeMusica.posicao());
  useEffect(() => {
    setPosicao(playerDeMusica.posicao());
    if (!tocando) return playerDeMusica.inscrever(() => setPosicao(playerDeMusica.posicao()));
    let quadro = 0;
    const atualizar = () => {
      setPosicao(playerDeMusica.posicao());
      quadro = requestAnimationFrame(atualizar);
    };
    quadro = requestAnimationFrame(atualizar);
    return () => cancelAnimationFrame(quadro);
  }, [tocando]);
  return posicao;
}
