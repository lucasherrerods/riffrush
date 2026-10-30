import { CORES_DO_PERSONAGEM } from "@/modules/rock/tema";

/**
 * Tudo que pode ser escolhido na criação do personagem.
 * - Novo personagem: gere um com scripts/gerar-personagem.mjs (docs/personagens.md) ou exporte um .vrm (VRoid Studio, Booth…), coloque em public/modelos/personagens e registre em BASES.
 * - Nova animação: rode scripts/preparar-animacoes.mjs com o .fbx da Mixamo e registre em ANIMACOES_POR_INSTRUMENTO.
 * - Nova peça: um .glb com malha presa ao esqueleto humanoide, em public/modelos/pecas, registrado em PECAS.
 */
export type Instrumento = "guitarra" | "baixo" | "keytar" | "bateria" | "vocal";
export type Expressao = "neutra" | "determinada" | "confiante" | "alegre";
export type ParteColorivel = "pele" | "cabelo" | "olhos" | "roupa" | "calca" | "calcados";

export interface Opcao<T extends string> {
  id: T;
  rotulo: string;
}

export interface Base extends Opcao<string> {
  /** O .vrm, ou a pasta do ator filmado quando `tipo` é "video". */
  arquivo: string;
  /** "video": pessoa filmada em 2D (scripts/preparar-ator.py). Sem tipo, é um VRM. */
  tipo?: "vrm" | "video";
}

export interface Peca extends Opcao<string> {
  arquivo: string;
  /** Partes do corpo base que a peça cobre e que ficam escondidas por baixo dela. */
  cobre: ParteColorivel[];
}

export const BASES: Base[] = [
  // Gerados por scripts/gerar-personagem.mjs a partir de personagens/*.json (veja docs/personagens.md). O primeiro é o padrão.
  { id: "roqueiro", rotulo: "Roqueiro", arquivo: "/modelos/personagens/roqueiro.vrm" },
  { id: "baixista", rotulo: "Baixista", arquivo: "/modelos/personagens/baixista.vrm" },
  { id: "tecladista", rotulo: "Tecladista", arquivo: "/modelos/personagens/tecladista.vrm" },
  { id: "vocalista", rotulo: "Vocalista", arquivo: "/modelos/personagens/vocalista.vrm" },
  { id: "baterista", rotulo: "Baterista", arquivo: "/modelos/personagens/baterista.vrm" },
  // Gente de verdade filmada, recortada por scripts/preparar-ator.py a partir de atores/*.json.
  { id: "sorriso", rotulo: "Sorriso (filmado)", arquivo: "/modelos/atores/sorriso", tipo: "video" },
  { id: "torcida", rotulo: "Torcida (filmado)", arquivo: "/modelos/atores/torcida", tipo: "video" },
];
export const PECAS: Peca[] = [];

export const tipoDoModelo = (id: string) => BASES.find((b) => b.id === id)?.tipo ?? "vrm";

export const INSTRUMENTOS: Opcao<Instrumento>[] = [
  { id: "guitarra", rotulo: "Guitarra" },
  { id: "baixo", rotulo: "Baixo" },
  { id: "keytar", rotulo: "Keytar" },
  { id: "bateria", rotulo: "Bateria" },
  { id: "vocal", rotulo: "Vocal" },
];

/** Animações compartilhadas por todos os personagens. Sem animação, o personagem fica no idle procedural. */
export const ANIMACOES_POR_INSTRUMENTO: Record<Instrumento, string[]> = {
  guitarra: ["guitarra-1", "guitarra-2"],
  baixo: ["guitarra-2", "guitarra-1"],
  keytar: ["teclado-1", "teclado-2"],
  bateria: [],
  vocal: [],
};
export const arquivoDaAnimacao = (id: string) => `/modelos/animacoes/${id}.glb`;

export const EXPRESSOES: Opcao<Expressao>[] = [
  { id: "neutra", rotulo: "Neutra" },
  { id: "determinada", rotulo: "Determinada" },
  { id: "confiante", rotulo: "Confiante" },
  { id: "alegre", rotulo: "Alegre" },
];

/** Ajustes do corpo, de 0 a 1 (0,5 é o modelo original). */
export const AJUSTES_DO_CORPO = [
  { id: "altura", rotulo: "Altura" },
  { id: "porte", rotulo: "Porte físico" },
  { id: "ombros", rotulo: "Ombros" },
] as const;

export const PARTES_COLORIVEIS: Opcao<ParteColorivel>[] = [
  { id: "pele", rotulo: "Pele" },
  { id: "cabelo", rotulo: "Cabelo" },
  { id: "olhos", rotulo: "Olhos" },
  { id: "roupa", rotulo: "Roupa" },
  { id: "calca", rotulo: "Calça" },
  { id: "calcados", rotulo: "Calçados" },
];

export const PALETAS: Record<ParteColorivel, string[]> = CORES_DO_PERSONAGEM;
