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
