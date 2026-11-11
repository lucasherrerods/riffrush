/** O que a tela de resultado precisa além da contagem: a ordem dos julgamentos e o quanto cada toque saiu do tempo. */
export interface Estatisticas {
  /** Códigos de MAX (0) a Miss (5), na ordem em que aconteceram. */
  julgamentos: number[];
  /** Em ms; negativo é cedo. Só os toques que acertaram: o Miss de um toque cedo demais ficaria fora da barra e puxaria a média. */
  desvios: number[];
}

// O mesmo peso do motor (ScoreV1): o MAX vale o mesmo que o 300.
const PESOS = [300, 300, 200, 100, 50, 0];
const JULGAMENTO_MISS = 5;

/** Lê os eventos do motor, em grupos de cinco: [nota, coluna, julgamento, fim, desvio (NaN sem toque)]. O fim da nota longa vem sem julgamento (-1). */
export function registrarEventos(estatisticas: Estatisticas, eventos: Float64Array) {
  for (let i = 0; i + 4 < eventos.length; i += 5) {
    const julgamento = eventos[i + 2];
    if (julgamento < 0) continue;
    estatisticas.julgamentos.push(julgamento);
    const desvio = eventos[i + 4];
    if (!Number.isNaN(desvio) && julgamento !== JULGAMENTO_MISS) estatisticas.desvios.push(desvio);
  }
}

/** A precisão acumulada ao longo da partida, em até `pontos` amostras; a última é a precisão final. */
export function curvaDaPrecisao(julgamentos: number[], pontos: number): number[] {
  const total = julgamentos.length;
  if (total === 0) return [];
  const amostras = Math.min(pontos, total);
  const curva: number[] = [];
  let soma = 0;
  let proxima = 1;
  for (let i = 0; i < total; i++) {
    soma += PESOS[julgamentos[i]] ?? 0;
    // A amostra k cai no julgamento ceil(k * total / amostras).
    if (i + 1 >= Math.ceil((proxima * total) / amostras)) {
      curva.push(soma / (300 * (i + 1)));
      proxima++;
    }
  }
  return curva;
}

export function resumoDosDesvios(desvios: number[]) {
  if (desvios.length === 0) return { media: 0, ur: 0 };
  const media = desvios.reduce((a, b) => a + b, 0) / desvios.length;
  const variancia = desvios.reduce((a, d) => a + (d - media) ** 2, 0) / desvios.length;
  return { media, ur: Math.sqrt(variancia) * 10 };
}

/** Conta os desvios em `faixas` iguais de -janela a +janela; os de fora contam na faixa da ponta. */
export function histogramaDosDesvios(desvios: number[], janela: number, faixas: number): number[] {
  const contagem = new Array<number>(faixas).fill(0);
  for (const d of desvios) {
    const faixa = Math.floor(((d + janela) / (2 * janela)) * faixas);
    contagem[Math.min(faixas - 1, Math.max(0, faixa))]++;
  }
  return contagem;
}

export const comoPorcentagem = (precisao: number) => `${(precisao * 100).toFixed(2).replace(".", ",")}%`;
