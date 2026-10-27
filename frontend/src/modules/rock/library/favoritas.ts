const CHAVE = "riffrush:favoritas";

/** As músicas favoritas ficam neste aparelho, pelo id, como os recordes. */
export function carregarFavoritas(): Set<string> {
  try {
    const lidas = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    return new Set(Array.isArray(lidas) ? lidas.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function salvarFavoritas(favoritas: Set<string>) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify([...favoritas]));
  } catch {
    // Sem armazenamento: as favoritas valem só até fechar o jogo.
  }
}

/** Marca ou desmarca a música, sem mexer no conjunto recebido. */
export function alternarFavorita(favoritas: Set<string>, id: string): Set<string> {
  const novas = new Set(favoritas);
  if (novas.has(id)) novas.delete(id);
  else novas.add(id);
  return novas;
}

/** Posições na lista das músicas que aparecem: todas, ou só as favoritas com o filtro ligado. */
export function indicesVisiveis(musicas: { id: string }[], favoritas: Set<string>, soFavoritas: boolean): number[] {
  return musicas.flatMap((m, i) => (!soFavoritas || favoritas.has(m.id) ? [i] : []));
}

/** Onde a seleção fica quando o filtro muda: no lugar, ou na próxima visível. Sem nenhuma visível, não há seleção. */
export function selecaoNoFiltro(visiveis: number[], indice: number): number | undefined {
  return visiveis.find((i) => i >= indice) ?? visiveis[0];
}
