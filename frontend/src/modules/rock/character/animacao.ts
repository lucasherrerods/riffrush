import { ANIMACOES_POR_INSTRUMENTO, type Instrumento } from "./catalogo";

/** Animação compartilhada do instrumento. A semente escolhe a variação, para os jogadores não ficarem idênticos. */
export function animacaoDoInstrumento(instrumento: Instrumento, semente: number) {
  const opcoes = ANIMACOES_POR_INSTRUMENTO[instrumento];
  return opcoes.length ? opcoes[Math.abs(Math.floor(semente)) % opcoes.length] : null;
}

type Euler = [number, number, number];
const CICLO_DA_RESPIRACAO = 3.5;

/** Pose parada usada quando não há animação do instrumento: tira o modelo da pose em T. Ângulos nos ossos normalizados do VRM. */
export const POSE_DE_DESCANSO: Record<string, Euler> = {
  spine: [0.04, 0, 0],
  leftUpperArm: [0, 0, -1.2],
  rightUpperArm: [0, 0, 1.2],
  leftLowerArm: [0, 0, -0.15],
  rightLowerArm: [0, 0, 0.15],
};

/**
 * Pequenas rotações somadas por cima de qualquer animação: respiração, cabeça no ritmo
 * (só sem animação de instrumento, que já balança) e o corpo abatido com a vida baixa.
 */
export function ajustesDaPose({ tempo, bpm, tocando, triste, comAnimacao }: { tempo: number; bpm: number; tocando: boolean; triste: boolean; comAnimacao: boolean }): Record<string, Euler> {
  const respiracao = Math.sin((tempo / CICLO_DA_RESPIRACAO) * Math.PI * 2);
  const fase = (tempo / (60 / Math.max(40, bpm))) * Math.PI * 2;
  const noRitmo = tocando && !comAnimacao ? (1 - Math.cos(fase)) / 2 : 0;
  const abatido = triste ? 1 : 0;
  return {
    spine: [abatido * 0.18, 0, 0],
    chest: [respiracao * 0.025, 0, 0],
    neck: [abatido * 0.15, 0, 0],
    head: [abatido * 0.3 + noRitmo * 0.22, comAnimacao ? 0 : Math.sin(tempo * 0.4) * 0.08, 0],
  };
}
