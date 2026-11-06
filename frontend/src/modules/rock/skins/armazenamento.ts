import type { SkinDaPista } from "./skins";

const CHAVE = "riffrush.highways";
let guardada: { texto: string; lista: SkinDaPista[] } | null = null;

const ehSkin = (s: Partial<SkinDaPista>): s is SkinDaPista =>
  typeof s?.id === "string" && typeof s.nome === "string" && typeof s.highway === "string" && typeof s.cores?.braco === "string";

/** As highways importadas pelo jogador. A mesma lista volta enquanto nada muda, para as opções da partida não mudarem à toa. */
export function carregarHighways(): SkinDaPista[] {
  try {
    const texto = localStorage.getItem(CHAVE) ?? "[]";
    if (guardada?.texto === texto) return guardada.lista;
    const dados: unknown = JSON.parse(texto);
    const lista = Array.isArray(dados) ? dados.filter(ehSkin) : [];
    guardada = { texto, lista };
    return lista;
  } catch {
    return [];
  }
}

/** Devolve falso se o navegador não teve espaço para guardar. */
export function salvarHighways(lista: SkinDaPista[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
    return true;
  } catch {
    return false;
  }
}
