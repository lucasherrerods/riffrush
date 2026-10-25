import { criarApiDaPresenca } from "./api";

function montar(resposta: unknown = [], status = 200) {
  const buscar = vi.fn(async () => new Response(status === 204 ? null : JSON.stringify(resposta), { status }));
  return { api: criarApiDaPresenca("https://api/", buscar as unknown as typeof fetch), buscar };
}

const pedido = (buscar: ReturnType<typeof vi.fn>) => {
  const [url, opcoes] = buscar.mock.calls[0] as [string, RequestInit];
  return { url, metodo: opcoes.method, token: (opcoes.headers as Record<string, string>).authorization };
};

describe("api da moderação", () => {
  it("lista as denúncias e os banidos com o token da moderação", async () => {
    const { api, buscar } = montar([{ conta_id: "a", nome: "Ana" }]);
    expect(await api.banidos("t")).toEqual([{ conta_id: "a", nome: "Ana" }]);
    expect(pedido(buscar)).toEqual({ url: "https://api/moderacao/banidos", metodo: "GET", token: "Bearer t" });
  });

  it("bane, desbane e resolve pelas rotas certas", async () => {
    for (const [chamar, metodo, url] of [
      [(api: ReturnType<typeof criarApiDaPresenca>) => api.banir("t", "id-1"), "POST", "https://api/moderacao/banidos/id-1"],
      [(api: ReturnType<typeof criarApiDaPresenca>) => api.desbanir("t", "id-1"), "DELETE", "https://api/moderacao/banidos/id-1"],
      [(api: ReturnType<typeof criarApiDaPresenca>) => api.resolver("t", 7), "DELETE", "https://api/moderacao/denuncias/7"],
    ] as const) {
      const { api, buscar } = montar(undefined, 204);
      await chamar(api);
      expect(pedido(buscar)).toMatchObject({ url, metodo });
    }
  });

  it("quem não é da moderação recebe o erro da API", async () => {
    const { api } = montar({ erro: "sem permissão" }, 403);
    await expect(api.denuncias("t")).rejects.toMatchObject({ status: 403 });
  });
});
