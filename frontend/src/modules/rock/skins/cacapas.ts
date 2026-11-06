import { CORES_DAS_CACAPAS, type CoresDaCacapa } from "@/shared/styles/tokens";

export const FORMATOS_DA_CACAPA = ["redonda", "retangular", "hexagonal"] as const;
/** O formato vale para as caçapas e para as notas que descem até elas. */
export type FormatoDaCacapa = (typeof FORMATOS_DA_CACAPA)[number];

/** O visual das caçapas (os botões da linha de batida) e das notas, separado do visual da pista. */
export interface SkinDaCacapa {
  id: string;
  nome: string;
  formato: FormatoDaCacapa;
  cores: CoresDaCacapa;
}

const pronta = (id: keyof typeof CORES_DAS_CACAPAS, nome: string, formato: FormatoDaCacapa): SkinDaCacapa => ({ id, nome, formato, cores: CORES_DAS_CACAPAS[id] });

export const CACAPAS_PRONTAS: SkinDaCacapa[] = [
  pronta("classica", "Clássica", "redonda"),
  pronta("neon", "Neon quadrada", "retangular"),
  pronta("colmeia", "Colmeia", "hexagonal"),
  pronta("cromada", "Cromada", "redonda"),
  pronta("contraste", "Alto contraste", "retangular"),
];

export const CACAPA_PADRAO = CACAPAS_PRONTAS[0];

export const cacapaPorId = (id: string) => CACAPAS_PRONTAS.find((c) => c.id === id) ?? CACAPA_PADRAO;
