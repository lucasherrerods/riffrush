import type { Musica } from "@/modules/songs";

/**
 * Onde as músicas importadas ficam salvas entre uma sessão e outra.
 * Uma música do histórico sem áudio guardado volta sem `arquivo`: é preciso importar ou baixar de novo.
 */
export interface Biblioteca {
  /** Da usada por último para a mais antiga. */
  listar(): Promise<Musica[]>;
  /** Guarda a música e o arquivo dela. Músicas sem arquivo (as embutidas) são ignoradas. */
  guardar(musica: Musica, capa?: Blob): Promise<void>;
  /** A música foi tocada: vai para o começo da fila. */
  usar(id: string): Promise<void>;
  remover(id: string): Promise<void>;
}
