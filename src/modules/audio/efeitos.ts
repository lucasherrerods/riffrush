import { obterContextoDeAudio } from "./contexto";

interface Efeito {
  onda: OscillatorType;
  de: number;
  para: number;
  duracao: number;
  volume: number;
}

export const EFEITOS = {
  mover: { onda: "square", de: 660, para: 660, duracao: 0.04, volume: 0.08 },
  selecionar: { onda: "square", de: 520, para: 1040, duracao: 0.12, volume: 0.1 },
  voltar: { onda: "square", de: 520, para: 260, duracao: 0.1, volume: 0.1 },
  erro: { onda: "sawtooth", de: 140, para: 70, duracao: 0.12, volume: 0.12 },
  estrela: { onda: "triangle", de: 880, para: 1760, duracao: 0.35, volume: 0.2 },
} satisfies Record<string, Efeito>;

export type NomeDoEfeito = keyof typeof EFEITOS;

/** Efeitos curtos de interface, sintetizados na hora. */
export function tocarEfeito(nome: NomeDoEfeito, volume: number) {
  if (volume <= 0) return;
  const efeito = EFEITOS[nome];
  const audio = obterContextoDeAudio();
  const inicio = audio.currentTime;
  const oscilador = audio.createOscillator();
  const ganho = audio.createGain();
  oscilador.connect(ganho).connect(audio.destination);

  oscilador.type = efeito.onda;
  oscilador.frequency.setValueAtTime(efeito.de, inicio);
  oscilador.frequency.exponentialRampToValueAtTime(efeito.para, inicio + efeito.duracao);
  ganho.gain.setValueAtTime(efeito.volume * volume, inicio);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + efeito.duracao);
  oscilador.start(inicio);
  oscilador.stop(inicio + efeito.duracao + 0.02);
}
