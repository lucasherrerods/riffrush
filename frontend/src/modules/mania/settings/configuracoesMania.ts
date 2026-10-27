import { OPCOES_PADRAO_DO_MANIA, type OpcoesDoMania } from "../gameplay/TelaDeJogoMania";

const CHAVE = "riffrush.mania.configuracoes";

export const LIMITES = {
  rolagemMs: { minimo: 200, maximo: 2000, passo: 50 },
  atrasoMs: { minimo: -300, maximo: 300, passo: 5 },
} as const;

const entre = (valor: unknown, minimo: number, maximo: number, padrao: number) =>
  typeof valor === "number" && Number.isFinite(valor) ? Math.min(maximo, Math.max(minimo, valor)) : padrao;

/** Lê o que veio do armazenamento sem confiar nele: valor fora da faixa ou quebrado volta ao padrão. */
export function normalizarConfiguracoes(lidas: Partial<OpcoesDoMania>): OpcoesDoMania {
  const teclas: Record<number, string[]> = {};
  for (const [k, lista] of Object.entries(lidas.teclasPersonalizadas ?? {})) {
    const n = Number(k);
    if (Number.isInteger(n) && n >= 1 && n <= 18 && Array.isArray(lista) && lista.length === n && lista.every((t) => typeof t === "string") && new Set(lista).size === n)
      teclas[n] = lista;
  }
  return {
    rolagemMs: entre(lidas.rolagemMs, LIMITES.rolagemMs.minimo, LIMITES.rolagemMs.maximo, OPCOES_PADRAO_DO_MANIA.rolagemMs),
    atrasoMs: entre(lidas.atrasoMs, LIMITES.atrasoMs.minimo, LIMITES.atrasoMs.maximo, OPCOES_PADRAO_DO_MANIA.atrasoMs),
    volumeDaMusica: entre(lidas.volumeDaMusica, 0, 1, OPCOES_PADRAO_DO_MANIA.volumeDaMusica),
    teclasPersonalizadas: teclas,
  };
}

export function carregarConfiguracoesDoMania(): OpcoesDoMania {
  try {
    return normalizarConfiguracoes(JSON.parse(localStorage.getItem(CHAVE) ?? "{}"));
  } catch {
    return OPCOES_PADRAO_DO_MANIA;
  }
}

export function salvarConfiguracoesDoMania(opcoes: OpcoesDoMania) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(opcoes));
  } catch {
    // Sem armazenamento: vale até fechar o app.
  }
}

/** Troca a tecla de uma coluna; se a tecla já era de outra coluna, as duas trocam de lugar. */
export function trocarTecla(teclas: string[], coluna: number, tecla: string): string[] {
  const novas = [...teclas];
  const antiga = novas.indexOf(tecla);
  if (antiga >= 0) novas[antiga] = novas[coluna];
  novas[coluna] = tecla;
  return novas;
}
