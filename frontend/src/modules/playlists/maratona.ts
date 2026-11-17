import type { Faixa } from "./playlists";

/** O que a maratona guarda de cada partida, igual nos dois modos. */
export interface ResultadoDaFaixa {
  pontos: number;
  /** De 0 a 1. */
  precisao: number;
  derrota: boolean;
}

export interface Maratona {
  nome: string;
  faixas: Faixa[];
  /** Um por faixa já passada; `null` quando foi pulada. */
  resultados: (ResultadoDaFaixa | null)[];
  terminou: boolean;
}

export const iniciarMaratona = (nome: string, faixas: Faixa[]): Maratona => ({ nome, faixas, resultados: [], terminou: faixas.length === 0 });

export const faixaAtual = (m: Maratona): Faixa | null => (m.terminou ? null : (m.faixas[m.resultados.length] ?? null));

function avancar(m: Maratona, resultado: ResultadoDaFaixa | null): Maratona {
  if (m.terminou) return m;
  const resultados = [...m.resultados, resultado];
  return { ...m, resultados, terminou: resultados.length >= m.faixas.length };
}

export const anotar = (m: Maratona, resultado: ResultadoDaFaixa) => avancar(m, resultado);

/** Música que não abriu (apagada, sem áudio) ou que a pessoa decidiu pular. */
export const pularFaixa = (m: Maratona) => avancar(m, null);

/**
 * Anda até a próxima faixa que o modo consegue abrir (`achar` devolve o que tocar, ou nada quando a música saiu da
 * biblioteca), pulando as que não abrem. Sem nenhuma, o alvo é nulo e a maratona termina.
 */
export function proximaTocavel<T>(atual: Maratona, achar: (faixa: Faixa) => T | null | undefined): { maratona: Maratona; alvo: T | null } {
  let m = atual;
  for (let faixa = faixaAtual(m); faixa; faixa = faixaAtual(m)) {
    const alvo = achar(faixa);
    if (alvo) return { maratona: m, alvo };
    m = pularFaixa(m);
  }
  return { maratona: m, alvo: null };
}

/** O botão da tela de resultado durante a maratona. */
export const rotuloDeSeguir = (m: Maratona) => (m.terminou ? "Ver a maratona" : `Próxima música (${m.resultados.length + 1}/${m.faixas.length})`);

export function placarDaMaratona(m: Maratona) {
  const tocadas = m.resultados.filter((r): r is ResultadoDaFaixa => r !== null);
  return {
    pontos: tocadas.reduce((soma, r) => soma + r.pontos, 0),
    precisao: tocadas.length ? tocadas.reduce((soma, r) => soma + r.precisao, 0) / tocadas.length : 0,
    tocadas: tocadas.length,
    concluidas: tocadas.filter((r) => !r.derrota).length,
    total: m.faixas.length,
  };
}
