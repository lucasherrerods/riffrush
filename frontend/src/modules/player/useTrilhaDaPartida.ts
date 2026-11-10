import { useEffect, useRef } from "react";
import type { FaixaDoPlayer, PlayerDeMusica } from "./playerDeMusica";

/** Onde o jogador está: nos menus a trilha toca; na partida e na tela de falha ela fica calada. */
export type FaseDaTrilha = "menu" | "jogo" | "falha";

/**
 * Cala a trilha dos menus durante a partida e na tela de falha. De volta aos menus, ela segue na música da partida:
 * do ponto em que o jogador saiu, ou num ponto sorteado se ele falhou.
 * Devolve a função que a tela de jogo chama com o ponto da música ao fechar.
 */
export function useTrilhaDaPartida<F extends FaixaDoPlayer>(player: PlayerDeMusica<F>, faixa: F | null, fase: FaseDaTrilha) {
  const ponto = useRef<number | null>(null);
  const falhou = useRef(false);
  const faixaDaPartida = useRef(faixa);
  faixaDaPartida.current = faixa;

  useEffect(() => {
    if (fase === "jogo") falhou.current = false;
    if (fase === "falha") falhou.current = true;
    const musica = faixaDaPartida.current;
    if (fase === "menu" && musica && (falhou.current || ponto.current !== null)) {
      player.voltarDaPartida(musica, falhou.current ? { tipo: "falhou" } : { tipo: "saiu", segundos: ponto.current ?? 0 });
    }
    if (fase === "menu") {
      ponto.current = null;
      falhou.current = false;
    }
    player.suspender(fase !== "menu", { esmaecer: fase === "menu" });
  }, [player, fase]);

  return (segundos: number) => {
    ponto.current = segundos;
  };
}
