import type { Batida, Secao } from "./tipos";

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
