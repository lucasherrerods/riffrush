import type { Instrumento } from "./catalogo";

export interface EntradaDaPose {
  /** Segundos desde que o avatar apareceu. */
  tempo: number;
  bpm: number;
  /** Segundos desde a última nota acertada. */
  desdeOPulso: number;
  tocando: boolean;
  triste: boolean;
  instrumento: Instrumento;
}

/** Ângulos em radianos e deslocamentos em metros, aplicados ao esqueleto procedural. */
export interface Pose {
  respiracao: number;
  /** Inclinação do tronco para a frente. */
  tronco: number;
  /** Cabeça para baixo (positivo) ou para cima. */
  cabeca: number;
  /** Força da palhetada (0 a 1), que dita o braço da mão que toca. */
  palhetada: number;
  /** Peso de um pé para o outro, no ritmo. */
  balanco: number;
}

const CICLO_DA_RESPIRACAO = 3.5;

export function calcularPose({ tempo, bpm, desdeOPulso, tocando, triste }: EntradaDaPose): Pose {
  const batida = 60 / Math.max(40, bpm);
  const fase = (tempo / batida) * Math.PI * 2;
  const noRitmo = tocando ? (1 - Math.cos(fase)) / 2 : 0;
  return {
    respiracao: Math.sin((tempo / CICLO_DA_RESPIRACAO) * Math.PI * 2) * 0.006,
    tronco: (triste ? 0.22 : 0.04) + noRitmo * 0.05,
    cabeca: (triste ? 0.4 : 0) + noRitmo * 0.18,
    palhetada: tocando ? Math.exp(-desdeOPulso * 10) : 0,
    balanco: tocando ? Math.sin(fase / 2) * 0.05 : 0,
  };
}
