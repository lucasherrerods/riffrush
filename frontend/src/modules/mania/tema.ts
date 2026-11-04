import { TEMAS } from "@/shared/styles/tokens";

/** O Mania desenha a pista sempre com o tema dele, rosa sobre roxo uva. */
export const TEMA_DO_MANIA = TEMAS.mania;
export const cores = TEMA_DO_MANIA.cores;

/** Cores do canvas da pista: aqui o brilho neon é permitido, por ser efeito de jogo. */
export const CORES_DA_PISTA = {
  fundo: "#130d17",
  colunaAlternada: "#1b1420",
  divisoria: "#2c2531",
  linhaDeJulgamento: "#f4eff8",
  receptor: "#3a333f",
  /** As notas: das bordas para o meio, alternando, e o centro dos mapas ímpares em ouro. */
  notaDaBorda: "#e0357f",
  notaDoMeio: "#f4eff8",
  notaDoCentro: "#facc15",
  vida: "#e0357f",
  fundoDaVida: "#3a333f",
};

/** Do MAX ao Miss. */
export const CORES_DOS_JULGAMENTOS = ["#f472b6", "#facc15", "#22c55e", "#38bdf8", "#b3a4bb", "#ef4444"];

/** Cor de cada coluna, simétrica como no mania: 4K é borda, meio, meio, borda; 7K tem o centro em ouro. */
export function coresDasColunas(teclas: number): string[] {
  return Array.from({ length: teclas }, (_, coluna) => {
    const distanciaDaBorda = Math.min(coluna, teclas - 1 - coluna);
    if (teclas % 2 === 1 && coluna === (teclas - 1) / 2 && teclas > 1) return CORES_DA_PISTA.notaDoCentro;
    return distanciaDaBorda % 2 === 0 ? CORES_DA_PISTA.notaDaBorda : CORES_DA_PISTA.notaDoMeio;
  });
}
