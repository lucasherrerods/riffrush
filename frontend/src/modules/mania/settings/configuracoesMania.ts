import { OPCOES_PADRAO_DO_MANIA, type OpcoesDoMania } from "../gameplay/TelaDeJogoMania";

/** O que só o Mania guarda. O volume da música vem do áudio global, o mesmo do Rock. */
export type ConfiguracoesDoMania = Omit<OpcoesDoMania, "volumeDaMusica">;

const { volumeDaMusica: _, ...padrao } = OPCOES_PADRAO_DO_MANIA;
export const CONFIGURACOES_PADRAO_DO_MANIA: ConfiguracoesDoMania = padrao;

const CHAVE = "riffrush.mania.configuracoes";

export const LIMITES = {
  rolagemMs: { minimo: 200, maximo: 2000, passo: 50 },
  atrasoMs: { minimo: -300, maximo: 300, passo: 5 },
} as const;

const entre = (valor: unknown, minimo: number, maximo: number, padrao: number) =>
  typeof valor === "number" && Number.isFinite(valor) ? Math.min(maximo, Math.max(minimo, valor)) : padrao;

/** Lê o que veio do armazenamento sem confiar nele: valor fora da faixa ou quebrado volta ao padrão. */
export function normalizarConfiguracoes(lidas: Partial<ConfiguracoesDoMania>): ConfiguracoesDoMania {
  const teclas: Record<number, string[]> = {};
  for (const [k, lista] of Object.entries(lidas.teclasPersonalizadas ?? {})) {
    const n = Number(k);
    if (Number.isInteger(n) && n >= 1 && n <= 18 && Array.isArray(lista) && lista.length === n && lista.every((t) => typeof t === "string") && new Set(lista).size === n)
      teclas[n] = lista;
  }
  return {
    rolagemMs: entre(lidas.rolagemMs, LIMITES.rolagemMs.minimo, LIMITES.rolagemMs.maximo, padrao.rolagemMs),
    atrasoMs: entre(lidas.atrasoMs, LIMITES.atrasoMs.minimo, LIMITES.atrasoMs.maximo, padrao.atrasoMs),
    teclasPersonalizadas: teclas,
  };
}

export function carregarConfiguracoesDoMania(): ConfiguracoesDoMania {
  try {
    return normalizarConfiguracoes(JSON.parse(localStorage.getItem(CHAVE) ?? "{}"));
  } catch {
    return CONFIGURACOES_PADRAO_DO_MANIA;
  }
}

export function salvarConfiguracoesDoMania(opcoes: ConfiguracoesDoMania) {
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
