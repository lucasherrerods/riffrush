import { useEffect, useRef } from "react";
import type { FaixaDoPlayer, PlayerDeMusica } from "./playerDeMusica";

/** Passando rápido pelo carrossel, o player não carrega cada música do caminho. */
export const ESPERA_PARA_SEGUIR_MS = 300;

interface Opcoes {
  /**
   * Na tela que abre na música tocando (`useMusicaAoEntrar`), o mapa de quando ela abre ainda é o antigo:
   * segui-lo levaria o player de volta a ele antes de a seleção ir para a música do player.
   */
  ficaNaQueTocaAoEntrar?: boolean;
}

/** Faz o player tocar o mapa escolhido na tela, depois que a escolha fica parada um instante. */
export function useSeguirMapa<F extends FaixaDoPlayer>(player: PlayerDeMusica<F>, faixa: F | null, { ficaNaQueTocaAoEntrar = false }: Opcoes = {}) {
  const fora = useRef(true);
  useEffect(() => {
    const entrando = fora.current;
    fora.current = !faixa;
    if (!faixa) return;
    if (entrando && ficaNaQueTocaAoEntrar && player.estado().musica) return;
    // Já decodificada (vizinha pré-carregada), não há trabalho a poupar: toca na hora.
    if (player.naMemoria(faixa)) return player.seguirMapa(faixa);
    const espera = setTimeout(() => player.seguirMapa(faixa), ESPERA_PARA_SEGUIR_MS);
    return () => clearTimeout(espera);
  }, [player, faixa, ficaNaQueTocaAoEntrar]);
}
