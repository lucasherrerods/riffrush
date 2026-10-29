// Cliente da API pública do Chorus Encore (enchor.us). Ela não tem documentação oficial:
// os formatos aqui vêm do próprio site, por isso a resposta é conferida antes de usar.
import type { Instrumento as InstrumentoDaPartida } from "@/modules/rock/songs";

const URL_DA_API = "https://api.enchor.us";
const URL_DOS_ARQUIVOS = "https://files.enchor.us";
const MD5 = /^[a-f0-9]{32}$/i;
/** A API devolve sempre 10 resultados por página. */
export const TAMANHO_DA_PAGINA = 10;

export const INSTRUMENTOS = {
  guitarra: "guitar",
  "guitarra-coop": "guitarcoop",
  ritmo: "rhythm",
  baixo: "bass",
  bateria: "drums",
  teclado: "keys",
} as const;

export const DIFICULDADES = {
  expert: "expert",
  dificil: "hard",
  medio: "medium",
  facil: "easy",
} as const;

/**
 * Os gêneros do filtro, como o Encore os escreve. A busca procura o pedaço do nome,
 * então "Metal" também traz Death Metal e Metalcore.
 */
export const GENEROS = {
  rock: "Rock",
  metal: "Metal",
  punk: "Punk",
  pop: "Pop",
  alternativo: "Alternative",
  indie: "Indie",
  progressivo: "Progressive",
  eletronica: "Electronic",
  "hip-hop": "Hip Hop",
  funk: "Funk",
  blues: "Blues",
  jazz: "Jazz",
  country: "Country",
  reggae: "Reggae",
} as const;

/** Sem sort, a API lista os envios mais recentes primeiro. */
export const ORDENS = {
  recentes: null,
  // Não é ordem do Encore: a lista vem do nosso ranking (ver buscarEntreOsCharts).
  "mais-jogadas": null,
  artista: { type: "artist", direction: "asc" },
  nome: { type: "name", direction: "asc" },
  "ano-mais-novo": { type: "year", direction: "desc" },
  "ano-mais-antigo": { type: "year", direction: "asc" },
  "mais-curtas": { type: "length", direction: "asc" },
  "mais-longas": { type: "length", direction: "desc" },
} as const;

export type Instrumento = keyof typeof INSTRUMENTOS;
export type Ordem = keyof typeof ORDENS;
export type DificuldadeDaBusca = keyof typeof DIFICULDADES;
export type Genero = keyof typeof GENEROS;

export interface FiltrosDaBusca {
  texto: string;
  instrumento: Instrumento | "todos";
  dificuldade: DificuldadeDaBusca | "todas";
  genero: Genero | "todos";
  ordem: Ordem;
  /** Só charts com vídeo de fundo. */
  soComVideo: boolean;
  /** Só charts da Harmonix, os oficiais de Guitar Hero e Rock Band. */
  soOficiais: boolean;
}

export const FILTROS_PADRAO: FiltrosDaBusca = { texto: "", instrumento: "todos", dificuldade: "todas", genero: "todos", ordem: "recentes", soComVideo: false, soOficiais: false };

const contem = (valor: string) => ({ value: valor, exact: false, exclude: false });

/** Gênero, vídeo e charter só existem na busca avançada, que não tem o campo de texto livre. */
export const usaBuscaAvancada = (filtros: FiltrosDaBusca) => filtros.genero !== "todos" || filtros.soComVideo || filtros.soOficiais;

/** Na busca avançada o texto procura no nome da música. */
export function montarCorpoDaBuscaAvancada(filtros: FiltrosDaBusca, pagina: number) {
  const { search: texto, ...comum } = montarCorpoDaBusca(filtros, pagina);
  return {
    ...comum,
    ...(filtros.genero !== "todos" && { genre: contem(GENEROS[filtros.genero]) }),
    ...(filtros.soComVideo && { hasVideoBackground: true }),
    ...(filtros.soOficiais && { charter: contem("Harmonix") }),
    ...(texto && { name: contem(texto) }),
  };
}

export interface ResultadoDaBusca {
  md5: string;
  titulo: string;
  artista: string;
  album: string;
  genero: string;
  ano: string;
  charter: string;
  duracaoMs: number;
  capa?: string;
  instrumentos: Instrumento[];
  /** Define a pasta do arquivo no servidor: charts mais novos ficam em `charts/v{N}/`. */
  versaoDoEncoder: number;
  /** O chart tem vídeo de fundo, e o Encore guarda também uma versão sem ele. */
  temVideo: boolean;
}

export interface RespostaDaBusca {
  total: number;
  resultados: ResultadoDaBusca[];
}

export function montarCorpoDaBusca(filtros: FiltrosDaBusca, pagina: number) {
  return {
    search: filtros.texto.trim(),
    page: pagina,
    instrument: filtros.instrumento === "todos" ? null : INSTRUMENTOS[filtros.instrumento],
    difficulty: filtros.dificuldade === "todas" ? null : DIFICULDADES[filtros.dificuldade],
    drumType: null,
    drumsReviewed: false,
    // A API aceita "website", "bridge" ou "api"; "api" identifica clientes de terceiros.
    source: "api",
    ...(ORDENS[filtros.ordem] && { sort: ORDENS[filtros.ordem] }),
  };
}

export function urlDaCapa(md5: unknown): string | undefined {
  return typeof md5 === "string" && MD5.test(md5) ? `${URL_DOS_ARQUIVOS}/${md5}.jpg` : undefined;
}

const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");
const INSTRUMENTO_DA_API = Object.fromEntries(Object.entries(INSTRUMENTOS).map(([nosso, daApi]) => [daApi, nosso])) as Record<string, Instrumento>;

function lerItem(item: Record<string, unknown>): ResultadoDaBusca | null {
  if (!MD5.test(texto(item.md5))) return null;
  const notas = item.notesData as { instruments?: unknown } | undefined;
  const instrumentos = Array.isArray(notas?.instruments) ? notas.instruments : [];
  return {
    md5: texto(item.md5),
    titulo: texto(item.name),
    artista: texto(item.artist),
    album: texto(item.album),
    genero: texto(item.genre),
    ano: texto(item.year),
    charter: texto(item.charter),
    duracaoMs: typeof item.song_length === "number" && item.song_length > 0 ? item.song_length : 0,
    capa: urlDaCapa(item.albumArtMd5),
    instrumentos: instrumentos.map((i) => INSTRUMENTO_DA_API[i as string]).filter(Boolean),
    versaoDoEncoder: Number.isSafeInteger(item.encoderVersion) && (item.encoderVersion as number) > 0 ? (item.encoderVersion as number) : 0,
    temVideo: item.hasVideoBackground === true,
  };
}

/**
 * O jogo ainda não tem bateria: um chart que só tem bateria abriria com a pista vazia.
 * Sem a lista de instrumentos (dado faltando no Encore), o chart continua aparecendo.
 */
const temAlgoParaTocar = (r: ResultadoDaBusca) => r.instrumentos.length === 0 || r.instrumentos.some((i) => i !== "bateria");

export function lerRespostaDaBusca(json: unknown): RespostaDaBusca {
  const corpo = json as { found?: unknown; data?: unknown } | null;
  if (typeof corpo?.found !== "number" || !Array.isArray(corpo.data)) {
    throw new Error("O Encore respondeu num formato inesperado.");
  }
  return {
    total: corpo.found,
    resultados: corpo.data.flatMap((item) => lerItem(item ?? {}) ?? []).filter(temAlgoParaTocar),
  };
}

export function formatarDuracao(ms: number): string {
  if (ms <= 0) return "";
  const segundos = Math.floor(ms / 1000);
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}

export async function buscarNoEncore(
  filtros: FiltrosDaBusca,
  pagina: number,
  { buscar = fetch, sinal }: { buscar?: typeof fetch; sinal?: AbortSignal } = {},
): Promise<RespostaDaBusca> {
  const avancada = usaBuscaAvancada(filtros);
  const resposta = await buscar(`${URL_DA_API}/search${avancada ? "/advanced" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(avancada ? montarCorpoDaBuscaAvancada(filtros, pagina) : montarCorpoDaBusca(filtros, pagina)),
    signal: sinal,
  });
  if (resposta.status === 429) throw new Error("Muitas buscas seguidas. Espere um pouco e tente de novo.");
  if (!resposta.ok) throw new Error("O Encore está indisponível agora. Tente de novo mais tarde.");
  return lerRespostaDaBusca(await resposta.json());
}

/** O Encore aceita vários md5 separados por vírgula; as 50 mais jogadas cabem em 5 páginas. */
const PAGINAS_ENTRE_OS_CHARTS = 5;

/**
 * Busca entre os charts da lista (as mais jogadas do ranking), com os mesmos filtros, e devolve na ordem da lista.
 * O Encore pagina na ordem dele, então todas as páginas vêm de uma vez e a paginação é feita aqui.
 */
export async function buscarEntreOsCharts(
  md5s: string[],
  filtros: FiltrosDaBusca,
  pagina: number,
  { buscar = fetch, sinal }: { buscar?: typeof fetch; sinal?: AbortSignal } = {},
): Promise<RespostaDaBusca> {
  const validos = md5s.filter((m) => MD5.test(m));
  if (!validos.length) return { total: 0, resultados: [] };
  const encontrados: ResultadoDaBusca[] = [];
  for (let paginaDoEncore = 1; paginaDoEncore <= PAGINAS_ENTRE_OS_CHARTS; paginaDoEncore++) {
    const resposta = await buscar(`${URL_DA_API}/search/advanced`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...montarCorpoDaBuscaAvancada(filtros, paginaDoEncore), hash: validos.join(",") }),
      signal: sinal,
    });
    if (resposta.status === 429) throw new Error("Muitas buscas seguidas. Espere um pouco e tente de novo.");
    if (!resposta.ok) throw new Error("O Encore está indisponível agora. Tente de novo mais tarde.");
    const lida = lerRespostaDaBusca(await resposta.json());
    encontrados.push(...lida.resultados);
    if (encontrados.length >= lida.total || lida.resultados.length < TAMANHO_DA_PAGINA) break;
  }
  const posicao = new Map(validos.map((m, i) => [m.toLowerCase(), i]));
  const ordenados = encontrados.filter((r) => posicao.has(r.md5.toLowerCase())).sort((a, b) => posicao.get(a.md5.toLowerCase())! - posicao.get(b.md5.toLowerCase())!);
  return { total: ordenados.length, resultados: ordenados.slice((pagina - 1) * TAMANHO_DA_PAGINA, pagina * TAMANHO_DA_PAGINA) };
}

/** O instrumento da partida com o nome que a busca usa. */
const INSTRUMENTO_DA_BUSCA: Record<InstrumentoDaPartida, Instrumento> = { guitarra: "guitarra", baixo: "baixo", ritmica: "ritmo", coop: "guitarra-coop", teclado: "teclado" };

/** Sorteia um chart oficial que tem a dificuldade no instrumento: a primeira página dá o total, a segunda é a sorteada. */
export async function sortearChartOficial(
  dificuldade: DificuldadeDaBusca,
  instrumento: InstrumentoDaPartida,
  { buscar = fetch, aleatorio = Math.random }: { buscar?: typeof fetch; aleatorio?: () => number } = {},
): Promise<ResultadoDaBusca> {
  const filtros: FiltrosDaBusca = { ...FILTROS_PADRAO, soOficiais: true, dificuldade, instrumento: INSTRUMENTO_DA_BUSCA[instrumento] };
  const primeira = await buscarNoEncore(filtros, 1, { buscar });
  if (!primeira.total) throw new Error("Nenhuma música oficial tem essa dificuldade nesse instrumento.");
  const pagina = 1 + Math.floor(aleatorio() * Math.ceil(primeira.total / TAMANHO_DA_PAGINA));
  const { resultados } = pagina === 1 ? primeira : await buscarNoEncore(filtros, pagina, { buscar });
  const lista = resultados.length ? resultados : primeira.resultados;
  return lista[Math.floor(aleatorio() * lista.length)];
}

/**
 * Acha um chart do Encore pelo md5 (o que o ranking guarda em `encore:<md5>`), com a pasta e o vídeo
 * que o download precisa. Devolve null se o Encore não tem mais esse chart.
 */
export async function buscarChartPeloMd5(md5: string, { buscar = fetch, sinal }: { buscar?: typeof fetch; sinal?: AbortSignal } = {}): Promise<ResultadoDaBusca | null> {
  if (!MD5.test(md5)) return null;
  const { search: _, ...comum } = montarCorpoDaBusca(FILTROS_PADRAO, 1);
  const resposta = await buscar(`${URL_DA_API}/search/advanced`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...comum, hash: md5 }),
    signal: sinal,
  });
  if (resposta.status === 429) throw new Error("Muitas buscas seguidas. Espere um pouco e tente de novo.");
  if (!resposta.ok) throw new Error("O Encore está indisponível agora. Tente de novo mais tarde.");
  return lerRespostaDaBusca(await resposta.json()).resultados.find((r) => r.md5 === md5) ?? null;
}

/** Mesmo caminho que o site monta. Por padrão baixa a versão sem vídeo, que é bem menor. */
export function montarUrlDoChart(resultado: ResultadoDaBusca, { comVideo = false } = {}): string {
  const pasta = resultado.versaoDoEncoder > 0 ? `charts/v${resultado.versaoDoEncoder}/` : "";
  const semVideo = resultado.temVideo && !comVideo ? "_novideo" : "";
  return `${URL_DOS_ARQUIVOS}/${pasta}${resultado.md5}${semVideo}.sng`;
}

const limparNome = (nome: string) => nome.replace(/[\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();

/** "Artista - Título.sng": a importação tira artista e título do nome quando o .sng não tem metadados. */
export function nomeDoArquivo(resultado: ResultadoDaBusca): string {
  const partes = [resultado.artista, resultado.titulo].map(limparNome).filter(Boolean);
  return `${partes.join(" - ") || resultado.md5}.sng`;
}

/** Só o caminho de um chart no servidor de arquivos do Encore. Mesma regra do relay (backend/relay/src/presenca.ts). */
const CHART_DO_ENCORE = /^https:\/\/files\.enchor\.us\/(?:charts\/v\d{1,3}\/)?([0-9a-f]{32})(?:_novideo)?\.sng$/;

/**
 * Link que outra pessoa mandou para quem assiste baixar: só vale se for um chart do Encore
 * e da mesma música (`encore:<md5>`) que está sendo tocada.
 */
export function linkDoChartConfere(url: unknown, musica: string): url is string {
  if (typeof url !== "string") return false;
  const md5 = CHART_DO_ENCORE.exec(url)?.[1];
  return !!md5 && musica === `encore:${md5}`;
}

/** No online o host manda a URL do chart: só baixamos se ela for mesmo um .sng do Encore. */
export function ehUrlDoEncore(texto: string): boolean {
  try {
    const url = new URL(texto);
    return url.origin === URL_DOS_ARQUIVOS && url.pathname.endsWith(".sng");
  } catch {
    return false;
  }
}
