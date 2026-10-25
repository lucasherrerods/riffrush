import { PISTA_ABERTA } from "@/modules/songs";
import { acertar, ativarEstrela, type Partida } from "./partida";

const TOQUE_RAPIDO = 0.08;
/** Os 5 trastes e a nota aberta. */
const PISTAS = PISTA_ABERTA + 1;

export interface Bot {
  /** Até quando cada traste fica apertado. */
  soltaEm: number[];
}

export function criarBot(): Bot {
  return { soltaEm: Array<number>(PISTAS).fill(-Infinity) };
}

/**
 * Toca sozinho todas as notas que já chegaram, sem depender da janela de acerto:
 * assim frames atrasados não fazem o bot errar. Devolve quais trastes estão apertados.
 */
export function jogarSozinho(bot: Bot, partida: Partida, tempo: number) {
  for (let i = partida.primeira; i < partida.notas.length && partida.notas[i].tempo <= tempo; i++) {
    const nota = partida.notas[i];
    if (nota.acertada || nota.perdida) continue;
    acertar(partida, nota, tempo);
    bot.soltaEm[nota.pista] = nota.tempo + Math.max(TOQUE_RAPIDO, nota.duracao);
  }
  ativarEstrela(partida);
  return bot.soltaEm.map((solta) => solta > tempo);
}
