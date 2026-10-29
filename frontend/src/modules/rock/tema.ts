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

/** Opções de cor para montar o personagem: conteúdo do jogo, não da interface. */
export const CORES_DO_PERSONAGEM = {
  pele: ["#f6dcc4", "#e8bf98", "#c99470", "#9a6644", "#5e3a24"],
  cabelo: ["#1c1a19", "#4a2e1c", "#8a5a2b", "#d9b56a", "#b9b6b0", "#8f1d1d", "#2b4c8c"],
  olhos: ["#3b2a1e", "#2f6b3a", "#2b5c9c", "#6b6b6b", "#a0482a"],
  roupa: ["#1f1d1b", "#5a1a1a", "#2d3a4f", "#3d4a2c", "#6b4a2e", "#d8d2c4"],
  calca: ["#1f1d1b", "#2d3a4f", "#4a3b2c", "#5a1a1a"],
  calcados: ["#1f1d1b", "#4a2e1c", "#8a1c1c", "#d8d2c4"],
};

/** Gradiente da capa das músicas que não trazem imagem. */
export const CAPAS: Record<"importada" | "sng" | "shine", [string, string]> = {
  importada: ["#14b8a6", "#1a1722"],
  sng: ["#f59e0b", "#7c2d12"],
  shine: ["#22d3ee", "#7c3aed"],
};
