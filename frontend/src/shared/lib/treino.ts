/*
 * O que o treino dos dois modos tem em comum: as partes da música, de onde cada volta
 * começa e termina, e a contagem das voltas.
 */

/** Uma parte marcada pelo autor do chart ou do mapa, em segundos da música. */
export interface Secao {
  nome: string;
  inicio: number;
}

export interface Batida {
  tempo: number;
  /** Começo de compasso. */
  forte: boolean;
}

export interface Trecho {
  nome: string;
  inicio: number;
  fim: number;
}

const COMPASSOS_POR_BLOCO = 8;
/** Um resto com menos compassos que isso no fim vira parte do bloco anterior. */
const MENOR_RESTO = 2;

/**
 * As partes da música para o treino. Usa as seções do chart; sem elas, divide em blocos
 * de compassos pelos tempos fortes, o que funciona também nos charts gerados do áudio.
 */
export function trechosDaMusica(secoes: Secao[], batidas: Batida[], duracao: number): Trecho[] {
  const validas = secoes.filter((s, i) => s.inicio >= 0 && s.inicio < duracao && secoes[i + 1]?.inicio !== s.inicio);
  if (validas.length) {
    const comComeco = validas[0].inicio > 0 ? [{ nome: "Começo", inicio: 0 }, ...validas] : validas;
    return comComeco.map((s, i) => ({ nome: s.nome, inicio: s.inicio, fim: comComeco[i + 1]?.inicio ?? duracao }));
  }

  const inicios = batidas.filter((b) => b.forte && b.tempo >= 0 && b.tempo < duracao).map((b) => b.tempo);
  if (!inicios.length) return [{ nome: "Música inteira", inicio: 0, fim: duracao }];
  const blocos: { primeiro: number; ultimo: number }[] = [];
  for (let c = 0; c < inicios.length; c += COMPASSOS_POR_BLOCO) blocos.push({ primeiro: c, ultimo: Math.min(c + COMPASSOS_POR_BLOCO, inicios.length) - 1 });
  const ultimo = blocos[blocos.length - 1];
  if (blocos.length > 1 && ultimo.ultimo - ultimo.primeiro + 1 < MENOR_RESTO) {
    blocos.pop();
    blocos[blocos.length - 1].ultimo = ultimo.ultimo;
  }
  return blocos.map((b, i) => ({
    nome: `Compassos ${b.primeiro + 1}–${b.ultimo + 1}`,
    inicio: i === 0 ? 0 : inicios[b.primeiro],
    fim: inicios[b.ultimo + 1] ?? duracao,
  }));
}

/** Segundos de música antes do trecho, para as primeiras notas descerem pela pista. */
const PREPARO = 2;
/** Segundos depois do fim do trecho, para julgar a última nota antes de voltar. */
const FOLGA = 0.5;

/** De onde a música volta e onde a volta acaba, no tempo real da partida (a música tocada na `velocidade`). */
export function limitesDaVolta(trecho: Trecho, velocidade: number, duracaoReal: number) {
  return {
    inicio: trecho.inicio / velocidade - PREPARO,
    // Chegar ao fim da música terminaria a partida: o último trecho volta um pouco antes.
    fim: Math.min(trecho.fim / velocidade + FOLGA, duracaoReal - FOLGA),
  };
}

export interface Voltas {
  voltas: number;
  /** Precisão da última volta, de 0 a 1. */
  ultima: number | null;
  melhor: number | null;
}

export const VOLTAS_INICIAIS: Voltas = { voltas: 0, ultima: null, melhor: null };

export const registrarVolta = (atual: Voltas, precisao: number): Voltas => ({
  voltas: atual.voltas + 1,
  ultima: precisao,
  melhor: Math.max(atual.melhor ?? 0, precisao),
});

/** O selo do treino: "volta 3 · última 94% · melhor 97%", só com o que já aconteceu. */
export function rotuloDasVoltas({ voltas, ultima, melhor }: Voltas) {
  const partes = voltas > 0 ? [`volta ${voltas + 1}`] : [];
  if (ultima !== null) partes.push(`última ${Math.round(ultima * 100)}%`);
  if (melhor !== null) partes.push(`melhor ${Math.round(melhor * 100)}%`);
  return partes.join(" · ");
}
