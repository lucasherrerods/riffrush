import { CORES_DAS_CACAPAS, type CoresDaCacapa } from "@/shared/styles/tokens";

/** O formato vale para as caçapas e para as notas que descem até elas. */
export type FormatoDaCacapa = "redonda" | "retangular" | "hexagonal";

export const FORMATOS_DA_CACAPA: { id: FormatoDaCacapa; nome: string }[] = [
  { id: "redonda", nome: "Redonda" },
  { id: "retangular", nome: "Retangular" },
  { id: "hexagonal", nome: "Hexagonal" },
];

export interface EsquemaDeCores {
  id: string;
  nome: string;
  cores: CoresDaCacapa;
  /** Pensado para quem tem daltonismo. */
  acessivel?: boolean;
}

const esquema = (id: keyof typeof CORES_DAS_CACAPAS, nome: string, acessivel = false): EsquemaDeCores => ({ id, nome, cores: CORES_DAS_CACAPAS[id], ...(acessivel && { acessivel }) });

export const ESQUEMAS_DE_CORES: EsquemaDeCores[] = [
  esquema("classica", "Clássica"),
  esquema("neon", "Neon"),
  esquema("intensa", "Intensa"),
  esquema("pastel", "Pastel"),
  esquema("contraste", "Alto contraste"),
  esquema("daltonismo", "Protanopia e deuteranopia", true),
  esquema("tritanopia", "Tritanopia", true),
];

export const ESQUEMA_PADRAO = ESQUEMAS_DE_CORES[0];

export const esquemaPorId = (id: string) => ESQUEMAS_DE_CORES.find((e) => e.id === id) ?? ESQUEMA_PADRAO;

/** O que a pista precisa para desenhar as caçapas e as notas. */
export interface EstiloDaCacapa {
  formato: FormatoDaCacapa;
  cores: CoresDaCacapa;
  /** Força do brilho das notas e das caçapas acesas, de 0 a 1. */
  brilho: number;
  /** Contorno claro e grosso nas notas, para ver melhor sobre qualquer pista. */
  contornoForte: boolean;
}

const estilos = new Map<string, EstiloDaCacapa>();

/** Combina o formato com o esquema de cores. As mesmas escolhas devolvem o mesmo objeto. */
export function estiloDaCacapa(formato: FormatoDaCacapa, esquemaId: string, brilho: number, contornoForte: boolean): EstiloDaCacapa {
  const forca = Math.min(1, Math.max(0, brilho));
  const chave = `${formato}:${esquemaId}:${forca}:${contornoForte}`;
  let estilo = estilos.get(chave);
  if (!estilo) estilos.set(chave, (estilo = { formato, cores: esquemaPorId(esquemaId).cores, brilho: forca, contornoForte }));
  return estilo;
}

export const ESTILO_PADRAO = estiloDaCacapa("redonda", ESQUEMA_PADRAO.id, 1, false);
