import { obterContextoDeAudio } from "./contexto";
import { saidaDeAudio } from "./volume";

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
  // Um "tunc" abafado e curto, de corda morta, para não confundir com o erro da derrota.
  notaPerdida: { onda: "square", de: 320, para: 110, duracao: 0.07, volume: 0.07 },
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
  oscilador.connect(ganho).connect(saidaDeAudio());

  oscilador.type = efeito.onda;
  oscilador.frequency.setValueAtTime(efeito.de, inicio);
  oscilador.frequency.exponentialRampToValueAtTime(efeito.para, inicio + efeito.duracao);
  ganho.gain.setValueAtTime(efeito.volume * volume, inicio);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + efeito.duracao);
  oscilador.start(inicio);
  oscilador.stop(inicio + efeito.duracao + 0.02);
}

/** Um trovão sintetizado: o estalo do raio e o ronco grave que vai sumindo. */
export function tocarTrovao(volume: number) {
  if (volume <= 0) return;
  const audio = obterContextoDeAudio();
  const inicio = audio.currentTime;
  const duracao = 1.8;
  const ruido = audio.createBuffer(1, Math.ceil(audio.sampleRate * duracao), audio.sampleRate);
  const amostras = ruido.getChannelData(0);
  for (let i = 0; i < amostras.length; i++) amostras[i] = Math.random() * 2 - 1;

  const fonte = audio.createBufferSource();
  fonte.buffer = ruido;
  const filtro = audio.createBiquadFilter();
  filtro.type = "lowpass";
  // Começa aberto (o estalo) e fecha no grave (o ronco).
  filtro.frequency.setValueAtTime(4000, inicio);
  filtro.frequency.exponentialRampToValueAtTime(120, inicio + 0.35);
  const ganho = audio.createGain();
  ganho.gain.setValueAtTime(0.9 * volume, inicio);
  ganho.gain.exponentialRampToValueAtTime(0.35 * volume, inicio + 0.3);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
  fonte.connect(filtro).connect(ganho).connect(saidaDeAudio());
  fonte.start(inicio);
  fonte.stop(inicio + duracao);
}
