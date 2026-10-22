/**
 * Tudo que pode ser escolhido na criação do personagem.
 * Para adicionar uma peça: inclua o id no tipo, registre aqui e desenhe-a em render3d/pecas.ts
 * (ou, quando houver modelos finais, aponte para o .glb dela).
 */
export type Cabelo = "rebelde" | "curto" | "longo" | "moicano" | "rabo" | "raspado";
export type Barba = "nenhuma" | "cavanhaque" | "cheia";
export type Roupa = "jaqueta" | "camiseta" | "sobretudo" | "colete";
export type Acessorio = "nenhum" | "oculos" | "fone" | "bandana";
export type Instrumento = "guitarra" | "baixo" | "keytar" | "bateria" | "vocal";

export interface Opcao<T extends string> {
  id: T;
  rotulo: string;
}

export const CABELOS: Opcao<Cabelo>[] = [
  { id: "rebelde", rotulo: "Rebelde" },
  { id: "curto", rotulo: "Curto" },
  { id: "longo", rotulo: "Longo" },
  { id: "moicano", rotulo: "Moicano" },
  { id: "rabo", rotulo: "Rabo de cavalo" },
  { id: "raspado", rotulo: "Raspado" },
];
export const BARBAS: Opcao<Barba>[] = [
  { id: "nenhuma", rotulo: "Nenhuma" },
  { id: "cavanhaque", rotulo: "Cavanhaque" },
  { id: "cheia", rotulo: "Cheia" },
];
export const ROUPAS: Opcao<Roupa>[] = [
  { id: "jaqueta", rotulo: "Jaqueta" },
  { id: "camiseta", rotulo: "Camiseta" },
  { id: "sobretudo", rotulo: "Sobretudo" },
  { id: "colete", rotulo: "Colete" },
];
export const ACESSORIOS: Opcao<Acessorio>[] = [
  { id: "nenhum", rotulo: "Nada" },
  { id: "oculos", rotulo: "Óculos escuros" },
  { id: "fone", rotulo: "Fone" },
  { id: "bandana", rotulo: "Bandana" },
];
export const INSTRUMENTOS: Opcao<Instrumento>[] = [
  { id: "guitarra", rotulo: "Guitarra" },
  { id: "baixo", rotulo: "Baixo" },
  { id: "keytar", rotulo: "Keytar" },
  { id: "bateria", rotulo: "Bateria" },
  { id: "vocal", rotulo: "Vocal" },
];

/** Ajustes do corpo e do rosto, de 0 a 1. Viram proporções em montagem.ts. */
export const AJUSTES_DO_CORPO = [
  { id: "altura", rotulo: "Altura" },
  { id: "porte", rotulo: "Porte físico" },
  { id: "ombros", rotulo: "Ombros" },
] as const;
export const AJUSTES_DO_ROSTO = [
  { id: "mandibula", rotulo: "Mandíbula" },
  { id: "olhos", rotulo: "Tamanho dos olhos" },
  { id: "sobrancelhas", rotulo: "Sobrancelhas" },
] as const;

/** Cores do conteúdo do personagem, não da interface: por isso ficam fora do tema. */
export const TONS_DE_PELE = ["#f6dcc4", "#e8bf98", "#c99470", "#9a6644", "#5e3a24"];
export const CORES_DE_CABELO = ["#1c1a19", "#4a2e1c", "#8a5a2b", "#d9b56a", "#b9b6b0", "#8f1d1d", "#2b4c8c"];
export const CORES_DOS_OLHOS = ["#3b2a1e", "#2f6b3a", "#2b5c9c", "#6b6b6b", "#a0482a"];
export const CORES_DE_ROUPA = ["#1f1d1b", "#5a1a1a", "#2d3a4f", "#3d4a2c", "#6b4a2e", "#d8d2c4"];
export const CORES_DE_DETALHE = ["#c9a227", "#a9a9a9", "#a3191f", "#2b2b2b"];
