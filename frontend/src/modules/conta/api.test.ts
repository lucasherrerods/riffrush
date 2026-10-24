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

  it("o perfil é um GET em /eu/perfil com o token", async () => {
    const buscar = vi.fn(async () => resposta(200, { nome: "Lucas" }));
    expect(await criarApi("http://api", buscar).perfil("t")).toEqual({ nome: "Lucas" });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api/eu/perfil");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer t");
  });

  it("excluir a conta é um DELETE em /eu com o token", async () => {
    const buscar = vi.fn(async () => resposta(204));
    await criarApi("http://api", buscar).excluirConta("t");
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api/eu");
    expect(init.method).toBe("DELETE");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer t");
  });

  it("aceita a URL da API com barra no fim sem gerar barra dupla", async () => {
    const buscar = vi.fn(async () => resposta(200, {}));
    await criarApi("http://api/", buscar).eu("t");
    const [url] = buscar.mock.calls[0] as unknown as [string];
    expect(url).toBe("http://api/eu");
  });

  it("204 não tem corpo", async () => {
    const api = criarApi("http://api", async () => resposta(204));
    await expect(api.sair("t")).resolves.toBeUndefined();
  });
});
