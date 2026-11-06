import { SKINS_DA_PISTA, type CoresDaSkinDaPista } from "@/shared/styles/tokens";

/**
 * O visual da pista do Rock: as cores das notas e das caçapas (os botões da linha de batida) e o braço.
 * `highway` é uma imagem no formato das highways do Clone Hero, que cobre o braço e corre junto com as notas.
 */
export interface SkinDaPista {
  id: string;
  nome: string;
  cores: CoresDaSkinDaPista;
  /** Data URL da imagem importada. Sem ela, o braço é o desenho do próprio jogo. */
  highway?: string;
}

const pronta = (id: keyof typeof SKINS_DA_PISTA, nome: string): SkinDaPista => ({ id, nome, cores: SKINS_DA_PISTA[id] });

export const SKINS_PRONTAS: SkinDaPista[] = [
  pronta("classica", "Clássica"),
  pronta("neon", "Neon"),
  pronta("brasa", "Brasa"),
  pronta("gelo", "Gelo"),
  pronta("contraste", "Alto contraste"),
];

export const SKIN_PADRAO = SKINS_PRONTAS[0];

/** A skin salva nas configurações. Se ela foi apagada, a pista volta para a padrão. */
export function skinPorId(id: string, importadas: SkinDaPista[]): SkinDaPista {
  return SKINS_PRONTAS.find((s) => s.id === id) ?? importadas.find((s) => s.id === id) ?? SKIN_PADRAO;
}
