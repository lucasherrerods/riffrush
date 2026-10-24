export type Dificuldade = "facil" | "medio" | "dificil" | "expert";

export const DIFICULDADES: { id: Dificuldade; rotulo: string }[] = [
  { id: "facil", rotulo: "Fácil" },
  { id: "medio", rotulo: "Médio" },
  { id: "dificil", rotulo: "Difícil" },
  { id: "expert", rotulo: "Expert" },
];

export type Instrumento = "guitarra" | "baixo" | "ritmica" | "coop" | "teclado";

/** Os instrumentos de 5 trastes que um chart do Clone Hero pode ter, na ordem em que aparecem na seleção. */
export const INSTRUMENTOS: { id: Instrumento; rotulo: string }[] = [
  { id: "guitarra", rotulo: "Guitarra" },
  { id: "baixo", rotulo: "Baixo" },
  { id: "ritmica", rotulo: "Rítmica" },
  { id: "coop", rotulo: "Guitarra coop" },
  { id: "teclado", rotulo: "Teclado" },
];

/** As dificuldades que o chart tem em cada instrumento. */
export type Trilhas = Partial<Record<Instrumento, Dificuldade[]>>;

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
  /** Os instrumentos e dificuldades que o chart do pacote tem. Sem elas, o chart é gerado na guitarra, nas quatro. */
  trilhas?: Trilhas;
  /** Como o pacote era guardado antes dos instrumentos: as dificuldades da guitarra. */
  dificuldades?: Dificuldade[];
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
