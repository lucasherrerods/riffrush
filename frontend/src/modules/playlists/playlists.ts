/** Uma música da playlist numa versão: a dificuldade no Rock, o beatmap no Mania. */
export interface Faixa {
  musica: string;
  versao: string;
  /** Para mostrar a lista mesmo sem a música baixada. */
  titulo: string;
}

/** A conta guarda até 10 playlists, somando os dois modos, e cada uma até 50 músicas. A API confere de novo. */
export const MAXIMO_DE_PLAYLISTS = 10;
export const MAXIMO_DE_FAIXAS = 50;

export interface Playlist {
  id: string;
  nome: string;
  /** Aparece no perfil para os amigos. */
  publica: boolean;
  faixas: Faixa[];
}

const mesmaFaixa = (a: Faixa, b: Faixa) => a.musica === b.musica && a.versao === b.versao;

export const contem = (playlist: Playlist, faixa: Faixa) => playlist.faixas.some((f) => mesmaFaixa(f, faixa));

export function criarPlaylist(lista: Playlist[], nome: string, novoId: () => string = () => crypto.randomUUID()): Playlist[] {
  return [...lista, { id: novoId(), nome: nome.trim().slice(0, 40) || `Playlist ${lista.length + 1}`, publica: true, faixas: [] }];
}

export const renomearPlaylist = (lista: Playlist[], id: string, nome: string): Playlist[] =>
  lista.map((p) => (p.id === id && nome.trim() ? { ...p, nome: nome.trim() } : p));

export const apagarPlaylist = (lista: Playlist[], id: string): Playlist[] => lista.filter((p) => p.id !== id);

/** Põe a faixa no fim da playlist, ou tira se ela já estava. Playlist cheia não ganha mais nenhuma. */
export function adicionarOuTirar(lista: Playlist[], id: string, faixa: Faixa): Playlist[] {
  return lista.map((p) => {
    if (p.id !== id) return p;
    if (contem(p, faixa)) return { ...p, faixas: p.faixas.filter((f) => !mesmaFaixa(f, faixa)) };
    return p.faixas.length >= MAXIMO_DE_FAIXAS ? p : { ...p, faixas: [...p.faixas, faixa] };
  });
}

export const alternarPublica = (lista: Playlist[], id: string): Playlist[] => lista.map((p) => (p.id === id ? { ...p, publica: !p.publica } : p));

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
      return [{ id: p.id, nome: p.nome, publica: p.publica !== false, faixas: p.faixas.flatMap(lerFaixa) }];
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
