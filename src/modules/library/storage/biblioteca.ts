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
  /** O arquivo guardado da música, ou nada se ele não está mais salvo. */
  abrir(id: string): Promise<File | undefined>;
}

/** O que fica salvo da música: os dados, sem os arquivos, que não sobrevivem fora da sessão. */
export type DadosDaMusica = Omit<Musica, "arquivo" | "imagemDeCapa" | "arquivoDeVideo" | "noAparelho">;

export function dadosDa(musica: Musica): DadosDaMusica {
  const { arquivo: _arquivo, imagemDeCapa: _capa, arquivoDeVideo: _video, noAparelho: _aparelho, ...dados } = musica;
  return dados;
}
