/** Direção do palco em funções puras: onde a câmera está e como as luzes reagem à música. */

type Vetor = [number, number, number];
export interface Plano {
  posicao: Vetor;
  alvo: Vetor;
}

const suave = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const misturar = (a: Vetor, b: Vetor, t: number): Vetor => a.map((v, i) => v + (b[i] - v) * t) as Vetor;

/**
 * Câmera do palco. Na contagem (tempo de -entrada a 0) faz um close no rosto do personagem
 * e recua até o plano aberto; durante a música fica aberta e de lado, deixando o personagem
 * à direita da pista, e balança devagar.
 */
export function planoDaCamera(tempo: number, entrada: number, altura: number): Plano {
  const balanco = Math.sin(tempo * 0.25) * 0.35;
  const aberto: Plano = {
    posicao: [-2.2 + balanco, altura * 0.95, 5.2],
    alvo: [-2.7 + balanco * 0.3, altura * 0.62, 0],
  };
  if (tempo >= 0) return aberto;
  const close: Plano = { posicao: [0.15, altura * 0.92, 1.25], alvo: [0, altura * 0.9, 0] };
  const t = suave(1 + tempo / entrada);
  return { posicao: misturar(close.posicao, aberto.posicao, t), alvo: misturar(close.alvo, aberto.alvo, t) };
}

/** A pista some no começo da contagem, para a cena do palco dominar, e aparece até a música começar. */
export function opacidadeDaPista(tempo: number, entrada: number) {
  if (tempo >= 0) return 1;
  return 0.1 + 0.9 * suave(1 + tempo / entrada);
}

const DURACAO_DO_CLARAO = 0.5;

/** Intensidade (0 a 1) das luzes no ritmo, clarão do trovão, cor dominante e foco geral do palco. */
export function luzesDoPalco({ tempo, bpm, desdeTrovao, estrelaAtiva }: { tempo: number; bpm: number; desdeTrovao: number; estrelaAtiva: boolean }) {
  const batida = 60 / Math.max(40, bpm);
  const fase = (((tempo % batida) + batida) % batida) / batida;
  return {
    intensidade: 0.55 + 0.45 * Math.exp(-fase * 6),
    clarao: desdeTrovao >= 0 && desdeTrovao < DURACAO_DO_CLARAO ? 1 - desdeTrovao / DURACAO_DO_CLARAO : 0,
    cor: estrelaAtiva ? ("estrela" as const) : ("primaria" as const),
    // Na abertura o palco é o centro; tocando, fica mais escuro para a pista se destacar.
    foco: tempo < 0 ? 1 : 0.6,
  };
}
