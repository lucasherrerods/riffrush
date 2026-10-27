import { ESPELHOS, ErroDaBusca, baixarOsz, buscarMapas, criarClienteDosEspelhos, traduzirConjunto } from "./api";

/** Um beatmapset no formato do osu! v2, como os espelhos devolvem. */
const conjunto = (id = 1, beatmaps = [{ id: 10, mode_int: 3, cs: 4, difficulty_rating: 3.2, version: "Hard", checksum: "a".repeat(32), total_length: 120 }]) => ({
  id,
  title: "Musica",
  title_unicode: "Música",
  artist: "Banda",
  artist_unicode: "Banda",
  creator: "Mapper",
  status: "ranked",
  preview_url: "//b.ppy.sh/preview/1.mp3",
  covers: { list: "https://assets.ppy.sh/beatmaps/1/covers/list.jpg" },
  beatmaps,
});

const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

describe("traduzirConjunto", () => {
  it("fica só com as dificuldades mania, em ordem de estrelas", () => {
    const traduzido = traduzirConjunto(
      conjunto(1, [
        { id: 11, mode_int: 3, cs: 7, difficulty_rating: 5.1, version: "7K Insane", checksum: "b".repeat(32), total_length: 120 },
        { id: 12, mode_int: 0, cs: 4, difficulty_rating: 2, version: "Osu", checksum: "c".repeat(32), total_length: 120 },
        { id: 10, mode_int: 3, cs: 4, difficulty_rating: 3.2, version: "4K Hard", checksum: "a".repeat(32), total_length: 120 },
      ]),
    );
    expect(traduzido).toMatchObject({
      beatmapsetId: 1,
      titulo: "Musica",
      tituloUnicode: "Música",
      mapper: "Mapper",
      status: "ranked",
      previa: "https://b.ppy.sh/preview/1.mp3",
      capa: "https://assets.ppy.sh/beatmaps/1/covers/list.jpg",
    });
    expect(traduzido?.dificuldades.map((d) => [d.nome, d.teclas, d.estrelas])).toEqual([
      ["4K Hard", 4, 3.2],
      ["7K Insane", 7, 5.1],
    ]);
  });

  it("um conjunto sem dificuldade mania fica de fora", () => {
    expect(traduzirConjunto(conjunto(1, [{ id: 1, mode_int: 1, cs: 4, difficulty_rating: 2, version: "Taiko", checksum: "a", total_length: 1 }]))).toBeNull();
  });
});

describe("buscarMapas", () => {
  it("pede ao primeiro espelho com os filtros e filtra as teclas no app", async () => {
    const buscar = vi.fn(async (_url: string | URL | Request) =>
      resposta([conjunto(1), conjunto(2, [{ id: 20, mode_int: 3, cs: 7, difficulty_rating: 4, version: "7K", checksum: "d".repeat(32), total_length: 1 }])]),
    );
    const cliente = criarClienteDosEspelhos({ buscar });
    const mapas = await buscarMapas({ texto: "camellia", status: "ranked", teclas: [7], pagina: 2 }, cliente);
    expect(mapas.map((m) => m.beatmapsetId)).toEqual([2]);
    const url = new URL(String(buscar.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://catboy.best/api/v2/search");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ q: "camellia", mode: "3", status: "1", limit: "50", offset: "100" });
  });

  it("sem status escolhido, não filtra", async () => {
    const buscar = vi.fn(async (_url: string | URL | Request) => resposta([]));
    await buscarMapas({ texto: "" }, criarClienteDosEspelhos({ buscar }));
    expect(new URL(String(buscar.mock.calls[0][0])).searchParams.has("status")).toBe(false);
  });

  it("quando um espelho falha, tenta o próximo e deixa o que falhou de lado por um tempo", async () => {
    let agora = 0;
    const buscar = vi.fn(async (url: string | URL | Request) => (String(url).startsWith("https://catboy.best") ? resposta({}, 530) : resposta([conjunto(1)])));
    const cliente = criarClienteDosEspelhos({ buscar, relogio: () => agora });
    expect(await buscarMapas({ texto: "a" }, cliente)).toHaveLength(1);
    expect(buscar).toHaveBeenCalledTimes(2);
    expect(String(buscar.mock.calls[1][0])).toMatch(/^https:\/\/osu\.direct\/api\/v2\/search\?.*amount=50/);
    // Logo depois, vai direto ao que funciona.
    await buscarMapas({ texto: "b" }, cliente);
    expect(buscar).toHaveBeenCalledTimes(3);
    // Passado o descanso, o primeiro volta a ser tentado.
    agora = 10 * 60_000;
    await buscarMapas({ texto: "c" }, cliente);
    expect(String(buscar.mock.calls[3][0])).toMatch(/^https:\/\/catboy\.best/);
  });

  it("um espelho que demora demais conta como falha", async () => {
    const buscar = vi.fn((url: string | URL | Request, opcoes?: RequestInit) =>
      String(url).startsWith("https://catboy.best")
        ? new Promise<Response>((_, rejeitar) => opcoes?.signal?.addEventListener("abort", () => rejeitar(new DOMException("tempo", "AbortError"))))
        : Promise.resolve(resposta([conjunto(1)])),
    );
    const cliente = criarClienteDosEspelhos({ buscar, tempoLimiteMs: 20 });
    expect(await buscarMapas({ texto: "a" }, cliente)).toHaveLength(1);
  });

  it("com todos os espelhos fora do ar, avisa", async () => {
    const cliente = criarClienteDosEspelhos({ buscar: vi.fn(async () => resposta({}, 500)) });
    await expect(buscarMapas({ texto: "a" }, cliente)).rejects.toThrow(ErroDaBusca);
  });
});

describe("baixarOsz", () => {
  it("baixa do espelho com o progresso", async () => {
    const bytes = new Uint8Array(1000).fill(7);
    const buscar = vi.fn(async (_url: string | URL | Request) => new Response(bytes, { headers: { "Content-Length": "1000" } }));
    const progresso: number[] = [];
    const osz = await baixarOsz(123, { aoProgredir: (p) => progresso.push(p) }, criarClienteDosEspelhos({ buscar }));
    expect(String(buscar.mock.calls[0][0])).toBe("https://catboy.best/d/123n");
    expect(osz.size).toBe(1000);
    expect(progresso.at(-1)).toBe(1);
  });

  it("tenta o próximo espelho quando o download falha", async () => {
    const buscar = vi.fn(async (url: string | URL | Request) => (String(url).includes("catboy") ? new Response("", { status: 404 }) : new Response(new Uint8Array(3))));
    const osz = await baixarOsz(5, {}, criarClienteDosEspelhos({ buscar }));
    expect(String(buscar.mock.calls[1][0])).toBe("https://osu.direct/api/d/5");
    expect(osz.size).toBe(3);
  });
});

it("os espelhos estão em ordem de preferência", () => {
  expect(ESPELHOS.map((e) => e.nome)).toEqual(["catboy.best", "osu.direct"]);
});
