export type Dificuldade = "facil" | "medio" | "dificil" | "expert";

export const DIFICULDADES: { id: Dificuldade; rotulo: string }[] = [
  { id: "facil", rotulo: "Fácil" },
  { id: "medio", rotulo: "Médio" },
  { id: "dificil", rotulo: "Difícil" },
  { id: "expert", rotulo: "Expert" },
];

export interface Nota {
  tempo: number;
  pista: number;
  /** Notas da mesma frase de star power têm o mesmo id; -1 é nota comum. */
  frase: number;
  /** Segundos de sustain; 0 é nota simples. */
  duracao: number;
}

export interface Batida {
  tempo: number;
  forte: boolean;
}

export interface Musica {
  id: string;
  titulo: string;
  artista: string;
  genero: string;
  bpm: number;
  /** Gradiente usado quando não há imagem de capa. */
  capa: [string, string];
  intensidade: number;
  /** Música que vem com o jogo: o endereço do áudio dentro do projeto. */
  audioEmbutido?: string;
  arquivo?: File;
  /** O arquivo importado é um clipe: o vídeo aparece durante a música. */
  video?: boolean;
  arquivoDeVideo?: Blob;
  /** Pacote do Clone Hero, com chart feito à mão. */
  sng?: boolean;
  imagemDeCapa?: string;
  /** O arquivo está salvo no PC e só é lido na hora de tocar. */
  noAparelho?: boolean;
  /** Veio da Busca músicas: o md5 do chart no Encore, para saber que ele já foi baixado. */
  md5DoEncore?: string;
  /** De onde o chart foi baixado: no modo online, os outros jogadores baixam do mesmo lugar. */
  urlDoEncore?: string;
}

export interface MusicaCarregada {
  audio: AudioBuffer;
  notas: Nota[];
  batidas: Batida[];
  duracao: number;
}
