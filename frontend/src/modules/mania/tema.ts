import { TEMAS } from "@/shared/styles/tokens";

/** O Mania desenha a pista sempre com o tema dele, rosa e branco. */
export const TEMA_DO_MANIA = TEMAS.mania;
export const cores = TEMA_DO_MANIA.cores;

/** Cores do canvas da pista: aqui o brilho neon é permitido, por ser efeito de jogo. */
export const CORES_DA_PISTA = {
  fundo: "#fbf6f8",
  colunaAlternada: "#f4ecf0",
  divisoria: "#e7d9df",
  linhaDeJulgamento: "#241c20",
  receptor: "#e2d3da",
  /** As notas: das bordas para o meio, alternando, e o centro dos mapas ímpares em ouro. */
  notaDaBorda: "#e0357f",
  notaDoMeio: "#9d174d",
  notaDoCentro: "#ca8a04",
  vida: "#e0357f",
  fundoDaVida: "#e7d9df",
};

/** Do MAX ao Miss. */
export const CORES_DOS_JULGAMENTOS = ["#db2777", "#ca8a04", "#15803d", "#0369a1", "#6b5f65", "#b91c1c"];

/** Cor de cada coluna, simétrica como no mania: 4K é borda, meio, meio, borda; 7K tem o centro em ouro. */
export function coresDasColunas(teclas: number): string[] {
  return Array.from({ length: teclas }, (_, coluna) => {
    const distanciaDaBorda = Math.min(coluna, teclas - 1 - coluna);
    if (teclas % 2 === 1 && coluna === (teclas - 1) / 2 && teclas > 1) return CORES_DA_PISTA.notaDoCentro;
    return distanciaDaBorda % 2 === 0 ? CORES_DA_PISTA.notaDaBorda : CORES_DA_PISTA.notaDoMeio;
  });
}
