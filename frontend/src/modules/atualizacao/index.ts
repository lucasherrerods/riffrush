import { avisarAtualizacao, buscarAtualizacao } from "./buscador";
import { useAtualizacao } from "./useAtualizacao";

/** Mantém o app desktop atualizado: baixa em segundo plano e oferece o reinício fora da partida. */
export function useAtualizacaoAutomatica(emPartida: boolean) {
  useAtualizacao({ emPartida, buscar: buscarAtualizacao, avisar: avisarAtualizacao });
}
