import type { ConjuntoSalvo } from "./biblioteca";

/** No celular só dá para tocar com o dedo até 5 colunas: mais que isso as colunas ficam estreitas demais. */
export const TECLAS_MAXIMAS_NO_CELULAR = 5;

export const cabeNoCelular = (teclas: number) => teclas <= TECLAS_MAXIMAS_NO_CELULAR;

/** A biblioteca vista do celular: só as dificuldades que cabem, e só os conjuntos que ficam com alguma. */
export function soOQueCabeNoCelular(conjuntos: ConjuntoSalvo[]): ConjuntoSalvo[] {
  return conjuntos.map((c) => ({ ...c, mapas: c.mapas.filter((m) => cabeNoCelular(m.teclas)) })).filter((c) => c.mapas.length);
}

/** As teclas pedidas à busca no celular: as escolhidas que cabem ou, sem escolha, todas as que cabem. */
export function teclasDaBuscaNoCelular(escolhidas: number[], todas: number[]): number[] {
  const validas = escolhidas.filter(cabeNoCelular);
  return validas.length ? validas : todas.filter(cabeNoCelular);
}
