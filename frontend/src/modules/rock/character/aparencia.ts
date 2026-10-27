import type { Expressao, ParteColorivel } from "./catalogo";
import type { Personagem } from "./personagem";

type Rgb = [number, number, number];

/**
 * Descobre qual parte do personagem um material pinta, pelo padrão de nomes do VRoid
 * (Body_00_SKIN, Hair_00_HAIR, EyeIris_00_EYE, Tops_01_CLOTH…). null fica com a cor original.
 */
export function categoriaDoMaterial(nome: string): ParteColorivel | null {
  if (/_SKIN(?![A-Za-z])/.test(nome)) return "pele";
  if (/_HAIR(?![A-Za-z])/.test(nome)) return "cabelo";
  if (/^EyeIris/.test(nome)) return "olhos";
  if (/^Bottoms.*_CLOTH/.test(nome)) return "calca";
  if (/^Shoes.*_CLOTH/.test(nome)) return "calcados";
  if (/_CLOTH(?![A-Za-z])/.test(nome)) return "roupa";
  return null;
}

const FATOR_MAXIMO = 4;

/**
 * Fator que multiplica a textura para a cor média dela virar a cor escolhida.
 * Assim o desenho da textura (dobras, mechas) continua, só que na cor nova.
 */
export function fatorDeTinta(mediaDaTextura: Rgb, cor: Rgb): Rgb {
  return cor.map((canal, i) => Math.min(FATOR_MAXIMO, canal / Math.max(mediaDaTextura[i], 0.01))) as Rgb;
}

type Escala = [number, number, number];
const entre = (minimo: number, maximo: number, t: number) => minimo + (maximo - minimo) * t;

/**
 * Escalas dos ossos do esqueleto humanoide para os sliders do corpo.
 * Um osso escalado escala os filhos também, então os filhos recebem a escala inversa
 * onde a mudança não deve continuar (a cabeça no porte, os braços nos ombros).
 */
export function escalasDoCorpo(corpo: Personagem["corpo"]) {
  const porte = entre(0.88, 1.12, corpo.porte);
  const ombros = entre(0.9, 1.1, corpo.ombros);
  const ossos: Record<string, Escala> = {
    spine: [porte, 1, porte],
    neck: [1 / porte, 1, 1 / porte],
    upperChest: [ombros, 1, 1],
    leftShoulder: [1 / ombros, 1, 1],
    rightShoulder: [1 / ombros, 1, 1],
  };
  return { altura: entre(0.92, 1.08, corpo.altura), ossos };
}

const PESOS_DA_EXPRESSAO: Record<Expressao, Record<string, number>> = {
  neutra: {},
  determinada: { angry: 0.35 },
  confiante: { relaxed: 0.55 },
  alegre: { happy: 0.6 },
};

const INTERVALO_ENTRE_PISCADAS = 3.7;
const DURACAO_DA_PISCADA = 0.16;

/** Pesos das expressões do VRM (happy, sad, blink…) para o momento atual. */
export function pesosDasExpressoes({ expressao, triste, tempo, desdeOPulso }: { expressao: Expressao; triste: boolean; tempo: number; desdeOPulso: number }) {
  const pesos: Record<string, number> = triste ? { sad: 0.8 } : { ...PESOS_DA_EXPRESSAO[expressao] };
  if (!triste) {
    const sorriso = Math.exp(-desdeOPulso * 4) * 0.5;
    if (sorriso > 0.01) pesos.happy = Math.max(pesos.happy ?? 0, sorriso);
  }
  const noCiclo = tempo % INTERVALO_ENTRE_PISCADAS;
  if (noCiclo < DURACAO_DA_PISCADA) pesos.blink = Math.sin((noCiclo / DURACAO_DA_PISCADA) * Math.PI);
  return pesos;
}
