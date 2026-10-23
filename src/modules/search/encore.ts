// Cliente da API pública do Chorus Encore (enchor.us). Ela não tem documentação oficial:
// os formatos aqui vêm do próprio site, por isso a resposta é conferida antes de usar.
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

export type Instrumento = keyof typeof INSTRUMENTOS;
export type DificuldadeDaBusca = keyof typeof DIFICULDADES;

export interface FiltrosDaBusca {
  texto: string;
  instrumento: Instrumento | "todos";
  dificuldade: DificuldadeDaBusca | "todas";
}

export const FILTROS_PADRAO: FiltrosDaBusca = { texto: "", instrumento: "todos", dificuldade: "todas" };

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

export function lerRespostaDaBusca(json: unknown): RespostaDaBusca {
  const corpo = json as { found?: unknown; data?: unknown } | null;
  if (typeof corpo?.found !== "number" || !Array.isArray(corpo.data)) {
    throw new Error("O Encore respondeu num formato inesperado.");
  }
  return {
    total: corpo.found,
    resultados: corpo.data.flatMap((item) => lerItem(item ?? {}) ?? []),
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
  const resposta = await buscar(`${URL_DA_API}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(montarCorpoDaBusca(filtros, pagina)),
    signal: sinal,
  });
  if (resposta.status === 429) throw new Error("Muitas buscas seguidas. Espere um pouco e tente de novo.");
  if (!resposta.ok) throw new Error("O Encore está indisponível agora. Tente de novo mais tarde.");
  return lerRespostaDaBusca(await resposta.json());
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
