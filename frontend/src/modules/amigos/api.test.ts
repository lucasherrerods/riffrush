import { criarApiDosAmigos } from "./api";

function montar(resposta: unknown = {}, status = 200) {
  const buscar = vi.fn(async () => new Response(status === 204 ? null : JSON.stringify(resposta), { status }));
  return { api: criarApiDosAmigos("https://api/", buscar as unknown as typeof fetch), buscar };
}

const pedido = (buscar: ReturnType<typeof vi.fn>) => {
  const [url, opcoes] = buscar.mock.calls[0] as [string, RequestInit];
  return { url, metodo: opcoes.method, corpo: opcoes.body, token: (opcoes.headers as Record<string, string>).authorization };
};

describe("api dos amigos", () => {
  it("busca as listas com o token", async () => {
    const { api, buscar } = montar({ codigo: "RIFF-ABCDEF", amigos: [], recebidos: [], enviados: [], bloqueados: [] });
    expect((await api.listas("t")).codigo).toBe("RIFF-ABCDEF");
    expect(pedido(buscar)).toMatchObject({ url: "https://api/amigos", metodo: "GET", token: "Bearer t" });
  });

  it("pede pelo código ou pela conta", async () => {
    const { api, buscar } = montar({ amigos: true });
    expect(await api.pedir("t", { codigo: "RIFF-ABCDEF" })).toEqual({ amigos: true });
    expect(pedido(buscar)).toMatchObject({ url: "https://api/amigos/pedidos", metodo: "POST", corpo: '{"codigo":"RIFF-ABCDEF"}' });
  });

  it("aceita, desfaz, bloqueia e desbloqueia pelas rotas certas", async () => {
    type Api = ReturnType<typeof criarApiDosAmigos>;
    for (const [chamar, metodo, url] of [
      [(api: Api) => api.aceitar("t", "id-1"), "POST", "https://api/amigos/id-1/aceitar"],
      [(api: Api) => api.desfazer("t", "id-1"), "DELETE", "https://api/amigos/id-1"],
      [(api: Api) => api.bloquear("t", "id-1"), "POST", "https://api/amigos/id-1/bloqueio"],
      [(api: Api) => api.desbloquear("t", "id-1"), "DELETE", "https://api/amigos/id-1/bloqueio"],
    ] as const) {
      const { api, buscar } = montar(undefined, 204);
      await chamar(api);
      expect(pedido(buscar)).toMatchObject({ url, metodo });
    }
  });

  it("o erro da API chega com a mensagem", async () => {
    const { api } = montar({ erro: "ninguém com esse código" }, 404);
    await expect(api.pedir("t", { codigo: "x" })).rejects.toMatchObject({ status: 404, message: "ninguém com esse código" });
  });
});
