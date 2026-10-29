/*
 * Busca e download de mapas do osu!mania pelos espelhos da comunidade.
 * Os pedidos saem do aparelho do jogador, com o IP dele: o servidor do Riff Rush não vê nada disso.
 * Os dois espelhos devolvem os conjuntos no formato da API do osu! v2 e liberam CORS, então o celular também busca.
 */

export type StatusDaBusca = "ranked" | "loved" | "qualified" | "todos";

/** Os números de status da API do osu!. */
const CODIGO_DO_STATUS: Record<Exclude<StatusDaBusca, "todos">, number> = { ranked: 1, qualified: 3, loved: 4 };

const POR_PAGINA = 50;
const MODO_MANIA = 3;
const TEMPO_LIMITE_MS = 5000;
/** Um espelho que falhou fica de lado por este tempo. */
const DESCANSO_MS = 2 * 60_000;

export interface DificuldadeDaBusca {
  beatmapId: number;
  nome: string;
  teclas: number;
  estrelas: number;
  /** md5 do .osu, o mesmo que o motor calcula. */
  hash: string;
  duracaoS: number;
}

export interface MapaDaBusca {
  beatmapsetId: number;
  titulo: string;
  tituloUnicode: string;
  artista: string;
  artistaUnicode: string;
  mapper: string;
  status: string;
  capa?: string;
  previa?: string;
  dificuldades: DificuldadeDaBusca[];
}

export interface FiltrosDaBusca {
  texto: string;
  status?: StatusDaBusca;
  /** Só os conjuntos com alguma dificuldade nestes números de teclas. Vazio é todos. */
  teclas?: number[];
  /** A partir de 0. */
  pagina?: number;
}

interface Espelho {
  nome: string;
  urlDaBusca: (filtros: FiltrosDaBusca) => string;
  urlDoDownload: (beatmapsetId: number) => string;
}

export const ESPELHOS: Espelho[] = [
  {
    nome: "catboy.best",
    urlDaBusca: ({ texto, status, pagina = 0 }) => {
      const params = new URLSearchParams({ q: texto, mode: String(MODO_MANIA), limit: String(POR_PAGINA), offset: String(pagina * POR_PAGINA) });
      if (status && status !== "todos") params.set("status", String(CODIGO_DO_STATUS[status]));
      return `https://catboy.best/api/v2/search?${params}`;
    },
    // O "n" pede o pacote sem o vídeo, que o Mania não usa e pesa dezenas de MB.
    urlDoDownload: (id) => `https://catboy.best/d/${id}n`,
  },
  {
    nome: "osu.direct",
    urlDaBusca: ({ texto, status, pagina = 0 }) => {
      const params = new URLSearchParams({ q: texto, mode: String(MODO_MANIA), amount: String(POR_PAGINA), offset: String(pagina * POR_PAGINA) });
      if (status && status !== "todos") params.set("status", String(CODIGO_DO_STATUS[status]));
      return `https://osu.direct/api/v2/search?${params}`;
    },
    urlDoDownload: (id) => `https://osu.direct/api/d/${id}`,
  },
];

export class ErroDaBusca extends Error {}

/** Os espelhos, com a memória de quais falharam há pouco. Um por app; os testes criam o seu. */
export function criarClienteDosEspelhos({ buscar = fetch.bind(globalThis), relogio = Date.now, tempoLimiteMs = TEMPO_LIMITE_MS, espelhos = ESPELHOS } = {}) {
  const falhouEm = new Map<string, number>();

  /** Chama `pedir` em cada espelho, do preferido ao último, pulando os que falharam há pouco (se houver outro). */
  async function emCadaEspelho<T>(pedir: (espelho: Espelho, sinal: AbortSignal) => Promise<T>, comTempoLimite = true): Promise<T> {
    const descansados = espelhos.filter((e) => relogio() - (falhouEm.get(e.nome) ?? -Infinity) >= DESCANSO_MS);
    const ordem = descansados.length ? descansados : espelhos;
    for (const espelho of ordem) {
      const controle = new AbortController();
      const limite = comTempoLimite ? setTimeout(() => controle.abort(), tempoLimiteMs) : undefined;
      try {
        const resultado = await pedir(espelho, controle.signal);
        falhouEm.delete(espelho.nome);
        return resultado;
      } catch {
        falhouEm.set(espelho.nome, relogio());
      } finally {
        clearTimeout(limite);
      }
    }
    throw new ErroDaBusca("Os espelhos do osu! não responderam. Tente de novo daqui a pouco.");
  }

  return { buscar, emCadaEspelho };
}

type ClienteDosEspelhos = ReturnType<typeof criarClienteDosEspelhos>;

let clientePadrao: ClienteDosEspelhos | undefined;
const padrao = () => (clientePadrao ??= criarClienteDosEspelhos());

interface ConjuntoDoOsu {
  id: number;
  title: string;
  title_unicode?: string;
  artist: string;
  artist_unicode?: string;
  creator: string;
  status: string;
  preview_url?: string;
  covers?: { list?: string; card?: string };
  beatmaps?: { id: number; mode_int: number; cs: number; difficulty_rating: number; version: string; checksum: string; total_length: number }[];
}

/** Do formato do osu! v2 para o nosso. Devolve `null` se o conjunto não tem nenhuma dificuldade mania. */
export function traduzirConjunto(conjunto: ConjuntoDoOsu): MapaDaBusca | null {
  const dificuldades = (conjunto.beatmaps ?? [])
    .filter((b) => b.mode_int === MODO_MANIA)
    .map((b) => ({ beatmapId: b.id, nome: b.version, teclas: Math.round(b.cs), estrelas: b.difficulty_rating, hash: b.checksum, duracaoS: b.total_length }))
    .sort((a, b) => a.estrelas - b.estrelas);
  if (!dificuldades.length) return null;
  const https = (url?: string) => (url?.startsWith("//") ? `https:${url}` : url);
  return {
    beatmapsetId: conjunto.id,
    titulo: conjunto.title,
    tituloUnicode: conjunto.title_unicode || conjunto.title,
    artista: conjunto.artist,
    artistaUnicode: conjunto.artist_unicode || conjunto.artist,
    mapper: conjunto.creator,
    status: conjunto.status,
    capa: https(conjunto.covers?.list ?? conjunto.covers?.card),
    previa: https(conjunto.preview_url),
    dificuldades,
  };
}

export async function buscarMapas(filtros: FiltrosDaBusca, cliente: ClienteDosEspelhos = padrao()): Promise<MapaDaBusca[]> {
  const conjuntos = await cliente.emCadaEspelho(async (espelho, signal) => {
    const resposta = await cliente.buscar(espelho.urlDaBusca(filtros), { signal });
    if (!resposta.ok) throw new Error(`${espelho.nome}: ${resposta.status}`);
    const corpo: unknown = await resposta.json();
    if (!Array.isArray(corpo)) throw new Error(`${espelho.nome}: resposta inesperada`);
    return corpo as ConjuntoDoOsu[];
  });
  const teclas = filtros.teclas ?? [];
  return conjuntos
    .map(traduzirConjunto)
    .filter((m): m is MapaDaBusca => m !== null)
    .filter((m) => !teclas.length || m.dificuldades.some((d) => teclas.includes(d.teclas)));
}

/** Baixa o .osz de um conjunto, com o progresso de 0 a 1 quando o espelho informa o tamanho. */
export async function baixarOsz(
  beatmapsetId: number,
  { aoProgredir, sinal }: { aoProgredir?: (progresso: number) => void; sinal?: AbortSignal } = {},
  cliente: ClienteDosEspelhos = padrao(),
): Promise<Blob> {
  // O download pode levar minutos numa conexão lenta: sem tempo limite, só o cancelamento do jogador.
  return cliente.emCadaEspelho(async (espelho) => {
    const resposta = await cliente.buscar(espelho.urlDoDownload(beatmapsetId), { signal: sinal });
    if (!resposta.ok || !resposta.body) throw new Error(`${espelho.nome}: ${resposta.status}`);
    const total = Number(resposta.headers.get("Content-Length")) || 0;
    const leitor = resposta.body.getReader();
    const partes: Uint8Array[] = [];
    let recebidos = 0;
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      partes.push(value);
      recebidos += value.length;
      if (total) aoProgredir?.(Math.min(1, recebidos / total));
    }
    aoProgredir?.(1);
    return new Blob(partes as BlobPart[], { type: "application/x-osu-beatmap-archive" });
  }, false);
}
