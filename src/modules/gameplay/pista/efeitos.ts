/** Efeitos de jogo da pista, em funções puras: o desenho fica em desenhar.ts. */

/** Combos que trovejam: 25, 50, 100 e depois a cada 50. Quanto maior, mais raios. */
export function forcaDoTrovao(sequencia: number) {
  if (sequencia === 25) return 1;
  if (sequencia === 50) return 2;
  if (sequencia >= 100 && sequencia % 50 === 0) return 3;
  return 0;
}

export interface Ponto {
  x: number;
  y: number;
}

/** Gerador pseudoaleatório com semente (mulberry32): o mesmo raio em todos os quadros da sua vida. */
function aleatorioComSemente(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Raio em zigue-zague do início ao fim, desviando até `desvio` pixels para os lados. */
export function pontosDoRaio(semente: number, inicio: Ponto, fim: Ponto, segmentos: number, desvio: number): Ponto[] {
  const aleatorio = aleatorioComSemente(semente);
  return Array.from({ length: segmentos + 1 }, (_, i) => {
    const t = i / segmentos;
    const lado = i === 0 || i === segmentos ? 0 : (aleatorio() * 2 - 1) * desvio;
    return { x: inicio.x + (fim.x - inicio.x) * t + lado, y: inicio.y + (fim.y - inicio.y) * t };
  });
}

const DURACAO_DO_TREMOR = 0.6;
const FORCA_DO_TREMOR = 9;

/** Deslocamento da pista ao soltar o star power: forte no começo, sumindo em 0,6 s. */
export function tremor(desdeAtivacao: number) {
  if (desdeAtivacao < 0 || desdeAtivacao >= DURACAO_DO_TREMOR) return { x: 0, y: 0, angulo: 0 };
  const forca = FORCA_DO_TREMOR * (1 - desdeAtivacao / DURACAO_DO_TREMOR) ** 2;
  return {
    x: Math.sin(desdeAtivacao * 97) * forca,
    y: Math.cos(desdeAtivacao * 83) * forca * 0.6,
    angulo: Math.sin(desdeAtivacao * 71) * forca * 0.002,
  };
}

const NOTAS_POR_NIVEL = 10;
const MULTIPLICADOR_MAXIMO = 4;

/** Quanto falta para o próximo multiplicador (0 a 1); 1 quando já está no máximo. */
export function progressoDoMultiplicador(sequencia: number) {
  if (sequencia >= NOTAS_POR_NIVEL * (MULTIPLICADOR_MAXIMO - 1)) return 1;
  return (sequencia % NOTAS_POR_NIVEL) / NOTAS_POR_NIVEL;
}
