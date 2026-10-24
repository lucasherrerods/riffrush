import { ErroDaApi, criarApi } from "./api";

const resposta = (status: number, corpo?: unknown) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status });

describe("criarApi", () => {
  it("manda o token no cabeçalho e o corpo em JSON", async () => {
    const buscar = vi.fn(async () => resposta(200, { xp_ganho: 10 }));
    const api = criarApi("http://api", buscar);
    await api.registrarPartida("t", { musica_id: "m", dificuldade: "medio", pontos: 1, acertos: 1, total: 1, derrota: false, fantasma: false });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api/partidas");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer t");
    expect(JSON.parse(init.body as string).musica_id).toBe("m");
  });

  it("transforma o erro da API numa exceção com status e mensagem", async () => {
    const api = criarApi("http://api", async () => resposta(429, { erro: "muitas requisições" }));
    await expect(api.eu("t")).rejects.toEqual(new ErroDaApi(429, "muitas requisições"));
    await expect(api.eu("t")).rejects.toMatchObject({ status: 429 });
  });

  it("204 não tem corpo", async () => {
    const api = criarApi("http://api", async () => resposta(204));
    await expect(api.sair("t")).resolves.toBeUndefined();
  });
});
