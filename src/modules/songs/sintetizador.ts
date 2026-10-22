import { geradorAleatorio } from "@/shared/lib/aleatorio";
import type { Composicao } from "./composicao";
import type { EstiloMusical } from "./tipos";

export const TAXA_DE_AMOSTRAGEM = 44100;

const frequenciaMidi = (nota: number) => 440 * Math.pow(2, (nota - 69) / 12);

/** Uma amostra de onda periódica; a fase é contada em ciclos. */
function onda(tipo: OscillatorType, fase: number) {
  const p = fase - Math.floor(fase);
  switch (tipo) {
    case "square":
      return p < 0.5 ? 1 : -1;
    case "triangle":
      return 1 - 4 * Math.abs(p - 0.5);
    case "sine":
      return Math.sin(p * 2 * Math.PI);
    default:
      return 2 * p - 1;
  }
}

interface OpcoesDoTom {
  desafinacao?: number;
  corte?: number;
  saturacao?: number;
  ataque?: number;
}

/**
 * Gera a música inteira amostra por amostra.
 * Montar milhares de nós num OfflineAudioContext era lento demais.
 */
export function sintetizar(estilo: EstiloMusical, composicao: Composicao) {
  const taxa = TAXA_DE_AMOSTRAGEM;
  const saida = new Float32Array(Math.ceil(composicao.duracao * taxa));
  const batida = 60 / estilo.bpm;
  const semicolcheia = batida / 4;
  const ruido = geradorAleatorio(1234);

  const notaDaEscala = (grau: number, oitava: number) =>
    estilo.tonica + estilo.escala[grau % estilo.escala.length] + 12 * (Math.floor(grau / estilo.escala.length) + oitava);

  const bumbo = (tempo: number) => {
    const inicio = Math.floor(tempo * taxa);
    let fase = 0;
    for (let i = 0; i < 0.25 * taxa && inicio + i < saida.length; i++) {
      const t = i / taxa;
      fase += (40 + 110 * Math.exp(-t * 30)) / taxa;
      saida[inicio + i] += Math.sin(fase * 2 * Math.PI) * Math.exp(-t * 14) * 0.9;
    }
  };

  // "brilho" controla quanto grave sai do ruído: alto vira chimbal, baixo vira caixa.
  const golpeDeRuido = (tempo: number, duracao: number, volume: number, brilho: number) => {
    const inicio = Math.floor(tempo * taxa);
    let anterior = 0;
    for (let i = 0; i < duracao * taxa && inicio + i < saida.length; i++) {
      const n = ruido() * 2 - 1;
      const agudo = n - anterior * brilho;
      anterior = n;
      saida[inicio + i] += agudo * Math.exp((-i / taxa / duracao) * 5) * volume;
    }
  };

  const tom = (tempo: number, duracao: number, frequencia: number, tipo: OscillatorType, volume: number, opcoes: OpcoesDoTom = {}) => {
    const inicio = Math.floor(tempo * taxa);
    const total = Math.floor(duracao * taxa);
    const frequencia2 = frequencia * Math.pow(2, (opcoes.desafinacao ?? 0) / 1200);
    const filtro = 1 - Math.exp((-2 * Math.PI * (opcoes.corte ?? 20000)) / taxa);
    const saturacao = opcoes.saturacao ?? 0;
    const ganho = 1 + saturacao * 12;
    const normalizacao = Math.tanh(ganho);
    const ataque = (opcoes.ataque ?? 0.005) * taxa;
    let filtrado = 0;
    for (let i = 0; i < total && inicio + i < saida.length; i++) {
      const t = i / taxa;
      let amostra = onda(tipo, frequencia * t);
      if (opcoes.desafinacao) amostra = (amostra + onda(tipo, frequencia2 * t)) * 0.5;
      if (saturacao > 0) amostra = Math.tanh(ganho * amostra) / normalizacao;
      filtrado += filtro * (amostra - filtrado);
      const envelope = Math.min(1, i / ataque) * Math.exp((-t / duracao) * 3) * Math.min(1, (total - i) / (0.01 * taxa));
      saida[inicio + i] += filtrado * envelope * volume;
    }
  };

  for (const compasso of composicao.compassos) {
    const pesado = compasso.secao === "refrao" || compasso.secao === "solo";
    for (let passo = 0; passo < 16; passo++) {
      const tempo = compasso.tempo + passo * semicolcheia;
      const naBatida = passo % 4 === 0;
      if (compasso.secao === "intro") {
        if (passo % 2 === 0) golpeDeRuido(tempo, 0.05, 0.08, 1);
        if (passo === 0 || passo === 8) bumbo(tempo);
        continue;
      }
      if (naBatida && (passo === 0 || passo === 8 || pesado)) bumbo(tempo);
      if (passo === 4 || passo === 12) golpeDeRuido(tempo, 0.18, 0.35, 0.3);
      if (compasso.secao === "solo" || passo % 2 === 0) golpeDeRuido(tempo, 0.04, naBatida ? 0.1 : 0.06, 1);
      if (passo % 2 === 0) {
        tom(tempo, semicolcheia * 1.9, frequenciaMidi(notaDaEscala(compasso.acorde, -2)), "sawtooth", 0.28, { corte: 600 });
      }
    }
    if (pesado) {
      for (const intervalo of [0, 2, 4]) {
        tom(compasso.tempo, batida * 4, frequenciaMidi(notaDaEscala(compasso.acorde + intervalo, 0)), "triangle", 0.05, { ataque: 0.1 });
      }
    }
  }

  // A melodia é tocada pela "guitarra" e é ela que vira as notas do jogo.
  for (let i = 0; i < composicao.melodia.length; i++) {
    const nota = composicao.melodia[i];
    const proxima = composicao.melodia[i + 1];
    const duracao = Math.min(proxima && proxima.tempo > nota.tempo ? proxima.tempo - nota.tempo : batida, batida) * 0.95;
    tom(nota.tempo, duracao, frequenciaMidi(notaDaEscala(nota.grau, 1)), estilo.timbre, 0.2 - estilo.distorcao * 0.06, {
      desafinacao: 10,
      corte: 2400 + estilo.distorcao * 1500,
      saturacao: estilo.distorcao,
    });
  }

  let pico = 0;
  for (const amostra of saida) pico = Math.max(pico, Math.abs(amostra));
  const ganhoFinal = pico > 0 ? 1.4 / pico : 1;
  for (let i = 0; i < saida.length; i++) saida[i] = Math.tanh(saida[i] * ganhoFinal) * 0.85;
  return saida;
}
