/** Extensões aceitas mesmo sem tipo: arrastado do sistema, o arquivo às vezes chega sem ele. */
const EXTENSOES = /\.(sng|mp3|ogg|opus|wav|flac|m4a|aac|mp4|webm|mkv|mov)$/i;

export const ehImportavel = (arquivo: File) => /^(audio|video)\//.test(arquivo.type) || EXTENSOES.test(arquivo.name);

export interface Progresso {
  /** De 0 a 1, somando todos os arquivos. */
  fracao: number;
  concluidos: number;
  total: number;
  /** O primeiro arquivo que ainda não terminou. */
  atual: string;
}

export function resumirProgresso(nomes: string[], fracoes: number[]): Progresso {
  const emAndamento = fracoes.findIndex((f) => f < 1);
  return {
    fracao: fracoes.reduce((soma, f) => soma + f, 0) / fracoes.length,
    concluidos: fracoes.filter((f) => f >= 1).length,
    total: nomes.length,
    atual: nomes[emAndamento === -1 ? nomes.length - 1 : emAndamento],
  };
}
