import { TEMAS } from "@/shared/styles/tokens";

/** O Rock tem tema fixo: o canvas da pista, do palco e dos personagens desenha sempre com ele, seja qual for o tema da interface. */
export const TEMA_DO_ROCK = TEMAS.riffRush;
export const cores = TEMA_DO_ROCK.cores;

/** Luzes e materiais das cenas 3D (palco e personagem). */
export const CORES_DA_CENA = {
  luz: "#ffffff",
  luzQuente: "#fff4e6",
  /** O telão mostra a textura sem tingir. */
  telao: "#ffffff",
  contorno: "#120d0b",
};

export const CORES_DOS_INSTRUMENTOS = {
  preto: "#16110f",
  marfim: "#e8e4dc",
  madeira: "#d9b98a",
  metal: "#c9c6c0",
  escala: "#2a1a12",
  gradeDoMicrofone: "#b9b6b0",
};

/** Gradiente da capa das músicas que não trazem imagem. */
export const CAPAS: Record<"importada" | "sng" | "shine", [string, string]> = {
  importada: ["#14b8a6", "#1a1722"],
  sng: ["#f59e0b", "#7c2d12"],
  shine: ["#22d3ee", "#7c3aed"],
};
