import { FILTROS_PADRAO, buscarNoEncore, montarCorpoDaBuscaAvancada, formatarDuracao, lerRespostaDaBusca, montarCorpoDaBusca, montarUrlDoChart, nomeDoArquivo, urlDaCapa, ehUrlDoEncore, linkDoChartConfere, type ResultadoDaBusca } from "./encore";

const itemDaApi = {
  name: "Enter Sandman",
  artist: "Metallica",
  album: "Metallica",
  genre: "Metal",
  year: "1991",
  charter: "Alguém",
  song_length: 331000,
  md5: "8d633d2940da9b3acda9074c2385e672",
  albumArtMd5: "b10343f168e302c8e3a79a3911b6291f",
  diff_guitar: 4,
  notesData: { instruments: ["guitar", "drums"] },
  encoderVersion: 0,
  hasVideoBackground: true,
};

describe("montarCorpoDaBusca", () => {
  it("traduz os filtros para o formato da API", () => {
    expect(montarCorpoDaBusca({ texto: " sandman ", instrumento: "bateria", dificuldade: "expert", genero: "todos" }, 2)).toEqual({
      search: "sandman",
      page: 2,
      instrument: "drums",
      difficulty: "expert",
      drumType: null,
      drumsReviewed: false,
      source: "api",
    });
  });

  it("sem filtro manda null para instrumento e dificuldade", () => {
    const corpo = montarCorpoDaBusca(FILTROS_PADRAO, 1);
    expect(corpo.instrument).toBeNull();
    expect(corpo.difficulty).toBeNull();
  });
});

describe("montarCorpoDaBuscaAvancada", () => {
  it("leva o gênero e o texto como pedaço do nome da música, além dos outros filtros", () => {
    expect(montarCorpoDaBuscaAvancada({ texto: " master ", instrumento: "baixo", dificuldade: "expert", genero: "metal" }, 3)).toEqual({
      page: 3,
      instrument: "bass",
      difficulty: "expert",
      drumType: null,
      drumsReviewed: false,
      source: "api",
      genre: { value: "Metal", exact: false, exclude: false },
      name: { value: "master", exact: false, exclude: false },
    });
  });

  it("sem texto, não filtra pelo nome", () => {
    expect(montarCorpoDaBuscaAvancada({ ...FILTROS_PADRAO, genero: "rock" }, 1)).not.toHaveProperty("name");
  });
});

describe("lerRespostaDaBusca", () => {
  it("converte os itens para o formato do app", () => {
    const resposta = lerRespostaDaBusca({ found: 18, page: 1, data: [itemDaApi] });
    expect(resposta.total).toBe(18);
    expect(resposta.resultados[0]).toEqual({
      md5: itemDaApi.md5,
      titulo: "Enter Sandman",
      artista: "Metallica",
      album: "Metallica",
      genero: "Metal",
      ano: "1991",
      charter: "Alguém",
      duracaoMs: 331000,
      capa: "https://files.enchor.us/b10343f168e302c8e3a79a3911b6291f.jpg",
      instrumentos: ["guitarra", "bateria"],
      versaoDoEncoder: 0,
      temVideo: true,
    });
  });

  it("campos faltando viram valores vazios", () => {
    const [r] = lerRespostaDaBusca({ found: 1, data: [{ md5: itemDaApi.md5, name: "X", artist: null }] }).resultados;
    expect(r).toMatchObject({ artista: "", charter: "", duracaoMs: 0, capa: undefined, instrumentos: [], versaoDoEncoder: 0, temVideo: false });
  });

  it("descarta itens sem md5 válido", () => {
    expect(lerRespostaDaBusca({ found: 1, data: [{ ...itemDaApi, md5: "x" }] }).resultados).toEqual([]);
  });

  it("falha com mensagem clara se a API mudar de formato", () => {
    expect(() => lerRespostaDaBusca({ coisa: 1 })).toThrow(/formato inesperado/);
  });
});

describe("urlDaCapa", () => {
  it("só monta a url para md5 válido", () => {
    expect(urlDaCapa("abc")).toBeUndefined();
    expect(urlDaCapa(null)).toBeUndefined();
  });
});

describe("formatarDuracao", () => {
  it("mostra minutos e segundos", () => {
    expect(formatarDuracao(263674)).toBe("4:23");
    expect(formatarDuracao(5000)).toBe("0:05");
    expect(formatarDuracao(0)).toBe("");
  });
});

describe("buscarNoEncore", () => {
  it("faz POST na API e lê a resposta", async () => {
    const buscar = vi.fn(async () => new Response(JSON.stringify({ found: 1, data: [itemDaApi] }), { status: 201 }));
    const resposta = await buscarNoEncore(FILTROS_PADRAO, 1, { buscar });
    expect(buscar).toHaveBeenCalledWith("https://api.enchor.us/search", expect.objectContaining({ method: "POST" }));
    expect(resposta.resultados).toHaveLength(1);
  });

  it("avisa quando passou do limite de buscas", async () => {
    const buscar = vi.fn(async () => new Response("", { status: 429 }));
    await expect(buscarNoEncore(FILTROS_PADRAO, 1, { buscar })).rejects.toThrow(/Muitas buscas/);
  });

  it("avisa quando a API responde com erro", async () => {
    const buscar = vi.fn(async () => new Response("", { status: 500 }));
    await expect(buscarNoEncore(FILTROS_PADRAO, 1, { buscar })).rejects.toThrow(/indisponível/);
  });
});

const md5 = "8d633d2940da9b3acda9074c2385e672";
const chart = (extra: Partial<ResultadoDaBusca> = {}): ResultadoDaBusca => ({
  md5, titulo: "Enter Sandman", artista: "Metallica", album: "", genero: "", ano: "", charter: "", duracaoMs: 0, instrumentos: [], versaoDoEncoder: 0, temVideo: false, ...extra,
});

describe("montarUrlDoChart", () => {
  it("chart antigo fica na raiz", () => {
    expect(montarUrlDoChart(chart())).toBe(`https://files.enchor.us/${md5}.sng`);
  });

  it("versões novas do encoder ficam na pasta da versão", () => {
    expect(montarUrlDoChart(chart({ versaoDoEncoder: 2 }))).toBe(`https://files.enchor.us/charts/v2/${md5}.sng`);
  });

  it("com vídeo de fundo, baixa a versão sem vídeo, a menos que peça o vídeo", () => {
    expect(montarUrlDoChart(chart({ temVideo: true }))).toBe(`https://files.enchor.us/${md5}_novideo.sng`);
    expect(montarUrlDoChart(chart({ temVideo: true }), { comVideo: true })).toBe(`https://files.enchor.us/${md5}.sng`);
  });
});

describe("nomeDoArquivo", () => {
  it("usa artista e título, como a importação espera", () => {
    expect(nomeDoArquivo(chart())).toBe("Metallica - Enter Sandman.sng");
  });

  it("tira caracteres que não podem ir no nome de arquivo", () => {
    expect(nomeDoArquivo(chart({ artista: "AC/DC", titulo: 'T.N.T: "Live"?' }))).toBe("AC DC - T.N.T Live.sng");
  });

  it("sem artista, usa só o título", () => {
    expect(nomeDoArquivo(chart({ artista: "" }))).toBe("Enter Sandman.sng");
  });
});

describe("ehUrlDoEncore", () => {
  it("só aceita .sng do servidor de arquivos do Encore", () => {
    expect(ehUrlDoEncore(`https://files.enchor.us/${md5}.sng`)).toBe(true);
    expect(ehUrlDoEncore(`https://files.enchor.us/charts/v2/${md5}_novideo.sng`)).toBe(true);
    expect(ehUrlDoEncore("https://malicioso.com/a.sng")).toBe(false);
    expect(ehUrlDoEncore("http://files.enchor.us/a.sng")).toBe(false);
    expect(ehUrlDoEncore("https://files.enchor.us/a.exe")).toBe(false);
    expect(ehUrlDoEncore("isso não é url")).toBe(false);
  });
});

describe("linkDoChartConfere", () => {
  const md5 = "0123456789abcdef0123456789abcdef";

  it("aceita o chart do Encore da mesma música", () => {
    expect(linkDoChartConfere(`https://files.enchor.us/${md5}.sng`, `encore:${md5}`)).toBe(true);
    expect(linkDoChartConfere(`https://files.enchor.us/charts/v3/${md5}_novideo.sng`, `encore:${md5}`)).toBe(true);
  });

  it("recusa outro site, truques na URL e chart de outra música", () => {
    for (const url of [
      `https://evil.com/${md5}.sng`,
      `https://files.enchor.us.evil.com/${md5}.sng`,
      `https://files.enchor.us@evil.com/${md5}.sng`,
      `https://files.enchor.us/${md5}.sng#x`,
      `https://files.enchor.us/${"f".repeat(32)}.sng`,
      42,
    ]) {
      expect(linkDoChartConfere(url, `encore:${md5}`)).toBe(false);
    }
  });

  it("com gênero, usa a busca avançada do Encore", async () => {
    const buscar = vi.fn(async () => new Response(JSON.stringify({ found: 0, data: [] }), { status: 200 }));
    await buscarNoEncore({ ...FILTROS_PADRAO, genero: "punk" }, 1, { buscar });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.enchor.us/search/advanced");
    expect(JSON.parse(init.body as string).genre).toEqual({ value: "Punk", exact: false, exclude: false });

    await buscarNoEncore(FILTROS_PADRAO, 1, { buscar });
    expect((buscar.mock.calls[1] as unknown as [string])[0]).toBe("https://api.enchor.us/search");
  });
});
