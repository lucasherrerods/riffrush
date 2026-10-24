import { adicionarSustains } from "./chart";
import type { Dificuldade, Nota } from "./tipos";

const TAMANHO_DA_FATIA = 512;
const JANELA_DA_MEDIA = 0.5;
const ESPACO_MINIMO: Record<Dificuldade, number> = { facil: 0.5, medio: 0.3, dificil: 0.18, expert: 0.11 };
const PISTAS: Record<Dificuldade, number> = { facil: 3, medio: 4, dificil: 5, expert: 5 };
const NOTAS_POR_CICLO_DE_ESTRELA = 40;
const NOTAS_DA_FRASE_DE_ESTRELA = 8;

/**
 * Gera notas para qualquer áudio: cada salto de energia do som (um ataque) vira uma nota.
 * A pista vem do "brilho" do som, medido pelas vezes que a onda cruza o zero.
 */
export function chartDoAudio(amostras: Float32Array, taxa: number, dificuldade: Dificuldade): Nota[] {
  const fatias = Math.floor(amostras.length / TAMANHO_DA_FATIA);
  const energia = new Float32Array(fatias);
  const brilho = new Float32Array(fatias);
  for (let f = 0; f < fatias; f++) {
    let soma = 0;
    let cruzamentos = 0;
    for (let i = f * TAMANHO_DA_FATIA + 1; i < (f + 1) * TAMANHO_DA_FATIA; i++) {
      soma += amostras[i] * amostras[i];
      if (amostras[i] >= 0 !== amostras[i - 1] >= 0) cruzamentos++;
    }
    energia[f] = Math.sqrt(soma / TAMANHO_DA_FATIA);
    brilho[f] = cruzamentos;
  }

  const salto = new Float32Array(fatias);
  for (let f = 1; f < fatias; f++) salto[f] = Math.max(0, energia[f] - energia[f - 1]);

  const janela = Math.round((JANELA_DA_MEDIA * taxa) / TAMANHO_DA_FATIA);
  const ataques: { tempo: number; brilho: number }[] = [];
  let ultimo = -Infinity;
  for (let f = 1; f < fatias - 1; f++) {
    const de = Math.max(0, f - janela);
    const ate = Math.min(fatias, f + janela);
    let media = 0;
    for (let j = de; j < ate; j++) media += salto[j];
    media /= ate - de;
    const ehPico = salto[f] > salto[f - 1] && salto[f] >= salto[f + 1];
    const tempo = (f * TAMANHO_DA_FATIA) / taxa;
    if (ehPico && salto[f] > media * 1.6 + 0.002 && tempo - ultimo >= ESPACO_MINIMO[dificuldade]) {
      ataques.push({ tempo, brilho: brilho[f] });
      ultimo = tempo;
    }
  }

  const pistas = PISTAS[dificuldade];
  const brilhosOrdenados = ataques.map((a) => a.brilho).sort((a, b) => a - b);
  const quantil = (q: number) => brilhosOrdenados[Math.floor(q * (brilhosOrdenados.length - 1))] ?? 0;
  const cortes = Array.from({ length: pistas - 1 }, (_, i) => quantil((i + 1) / pistas));

  let frase = -1;
  const notas = ataques.map((ataque, i): Nota => {
    const posicao = i % NOTAS_POR_CICLO_DE_ESTRELA;
    if (posicao === NOTAS_POR_CICLO_DE_ESTRELA / 2) frase++;
    const naFrase = posicao >= NOTAS_POR_CICLO_DE_ESTRELA / 2 && posicao < NOTAS_POR_CICLO_DE_ESTRELA / 2 + NOTAS_DA_FRASE_DE_ESTRELA;
    return {
      tempo: ataque.tempo,
      pista: cortes.filter((corte) => ataque.brilho > corte).length,
      frase: naFrase ? frase : -1,
      duracao: 0,
    };
  });
  return adicionarSustains(notas, 0.7, 0.3);
}
