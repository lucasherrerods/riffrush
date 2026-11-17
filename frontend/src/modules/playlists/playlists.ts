/** Uma música da playlist numa versão: a dificuldade no Rock, o beatmap no Mania. */
export interface Faixa {
  musica: string;
  versao: string;
  /** Para mostrar a lista mesmo sem a música baixada. */
  titulo: string;
}

export interface Playlist {
  id: string;
  nome: string;
  faixas: Faixa[];
}

const mesmaFaixa = (a: Faixa, b: Faixa) => a.musica === b.musica && a.versao === b.versao;

export const contem = (playlist: Playlist, faixa: Faixa) => playlist.faixas.some((f) => mesmaFaixa(f, faixa));

export function criarPlaylist(lista: Playlist[], nome: string, novoId: () => string = () => crypto.randomUUID()): Playlist[] {
  return [...lista, { id: novoId(), nome: nome.trim() || `Playlist ${lista.length + 1}`, faixas: [] }];
}

export const renomearPlaylist = (lista: Playlist[], id: string, nome: string): Playlist[] =>
  lista.map((p) => (p.id === id && nome.trim() ? { ...p, nome: nome.trim() } : p));

export const apagarPlaylist = (lista: Playlist[], id: string): Playlist[] => lista.filter((p) => p.id !== id);

/** Põe a faixa no fim da playlist, ou tira se ela já estava. */
export function adicionarOuTirar(lista: Playlist[], id: string, faixa: Faixa): Playlist[] {
  return lista.map((p) => (p.id !== id ? p : { ...p, faixas: contem(p, faixa) ? p.faixas.filter((f) => !mesmaFaixa(f, faixa)) : [...p.faixas, faixa] }));
}

const ehTexto = (v: unknown): v is string => typeof v === "string";

function lerFaixa(v: unknown): Faixa[] {
  const f = v as Partial<Faixa> | null;
  return f && ehTexto(f.musica) && ehTexto(f.versao) && ehTexto(f.titulo) ? [{ musica: f.musica, versao: f.versao, titulo: f.titulo }] : [];
}

/** As playlists ficam neste aparelho, cada modo na sua chave, como as favoritas. */
export function carregarPlaylists(chave: string): Playlist[] {
  try {
    const lidas: unknown = JSON.parse(localStorage.getItem(chave) ?? "[]");
    if (!Array.isArray(lidas)) return [];
    return lidas.flatMap((v) => {
      const p = v as Partial<Playlist> | null;
      if (!p || !ehTexto(p.id) || !ehTexto(p.nome) || !Array.isArray(p.faixas)) return [];
      return [{ id: p.id, nome: p.nome, faixas: p.faixas.flatMap(lerFaixa) }];
    });
  } catch {
    return [];
  }
}

export function salvarPlaylists(chave: string, lista: Playlist[]) {
  try {
    localStorage.setItem(chave, JSON.stringify(lista));
  } catch {
    // Sem armazenamento: as playlists valem só até fechar o jogo.
  }
}
