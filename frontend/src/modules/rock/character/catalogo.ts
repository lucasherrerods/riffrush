/**
 * Os personagens que dá para escolher: um por instrumento, cada um com as próprias skins.
 * - Personagem filmado: rode scripts/preparar-ator.py (ou monte a folha de sprites à mão) e coloque a pasta em public/modelos/atores.
 * - Personagem 3D: gere com scripts/gerar-personagem.mjs (docs/personagens.md) e coloque o .vrm em public/modelos/personagens.
 * - Nova animação: rode scripts/preparar-animacoes.mjs com o .fbx da Mixamo e registre em ANIMACOES_POR_INSTRUMENTO.
 */
export type Instrumento = "guitarra" | "baixo" | "keytar" | "bateria" | "vocal";

export interface Opcao<T extends string> {
  id: T;
  rotulo: string;
}

export interface Skin extends Opcao<string> {
  /** O .vrm, ou a pasta do ator filmado quando `tipo` é "video". */
  arquivo: string;
  /** "video": pessoa filmada em 2D. Sem tipo, é um VRM. */
  tipo?: "vrm" | "video";
}

export interface DefinicaoDePersonagem extends Opcao<string> {
  instrumento: Instrumento;
  skins: Skin[];
}

/** O primeiro é o padrão. */
export const PERSONAGENS: DefinicaoDePersonagem[] = [
  { id: "faisca", rotulo: "Faísca", instrumento: "guitarra", skins: [{ id: "classico", rotulo: "Clássico", arquivo: "/modelos/atores/faisca", tipo: "video" }] },
  { id: "baixista", rotulo: "Baixista", instrumento: "baixo", skins: [{ id: "padrao", rotulo: "Padrão", arquivo: "/modelos/personagens/baixista.vrm" }] },
  { id: "tecladista", rotulo: "Tecladista", instrumento: "keytar", skins: [{ id: "padrao", rotulo: "Padrão", arquivo: "/modelos/personagens/tecladista.vrm" }] },
  { id: "baterista", rotulo: "Baterista", instrumento: "bateria", skins: [{ id: "padrao", rotulo: "Padrão", arquivo: "/modelos/personagens/baterista.vrm" }] },
  { id: "vocalista", rotulo: "Vocalista", instrumento: "vocal", skins: [{ id: "padrao", rotulo: "Padrão", arquivo: "/modelos/personagens/vocalista.vrm" }] },
];

export const definicaoDoPersonagem = ({ personagem }: { personagem: string }) => PERSONAGENS.find((p) => p.id === personagem) ?? PERSONAGENS[0];
export const instrumentoDoPersonagem = (escolha: { personagem: string }) => definicaoDoPersonagem(escolha).instrumento;
export function skinDoPersonagem(escolha: { personagem: string; skin: string }) {
  const { skins } = definicaoDoPersonagem(escolha);
  return skins.find((s) => s.id === escolha.skin) ?? skins[0];
}

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
