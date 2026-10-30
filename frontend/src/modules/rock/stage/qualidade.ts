export type QualidadeDoPalco = "leve" | "media" | "alta";

export const QUALIDADES_DO_PALCO: { id: QualidadeDoPalco; rotulo: string }[] = [
  { id: "leve", rotulo: "Leve" },
  { id: "media", rotulo: "Média" },
  { id: "alta", rotulo: "Alta" },
];

/** O palco divide a placa de vídeo com a pista: menos resolução e menos quadros deixam a pista lisa em PCs fracos. */
const AJUSTES: Record<QualidadeDoPalco, { resolucao: number; quadrosPorSegundo: number }> = {
  leve: { resolucao: 0.4, quadrosPorSegundo: 20 },
  media: { resolucao: 0.6, quadrosPorSegundo: 30 },
  alta: { resolucao: 1, quadrosPorSegundo: 60 },
};

export const ajustesDoPalco = (qualidade: QualidadeDoPalco) => AJUSTES[qualidade];

/** Fração da resolução nativa em que a pista é desenhada: menos pixels aliviam placas de vídeo fracas. */
export const ESCALA_MINIMA_DE_RENDERIZACAO = 0.5;

export function limitarEscalaDeRenderizacao(escala: number) {
  if (!Number.isFinite(escala)) return 1;
  return Math.min(1, Math.max(ESCALA_MINIMA_DE_RENDERIZACAO, escala));
}

/** Pixels do canvas por pixel CSS. Telas muito densas param em 2 antes da escala escolhida. */
export const escalaDoCanvas = (densidadeDaTela: number, escala: number) => Math.min(2, densidadeDaTela || 1) * limitarEscalaDeRenderizacao(escala);
