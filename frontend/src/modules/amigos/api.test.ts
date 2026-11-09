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

  it("avisa o modo aberto, que a API guarda como o último em que a pessoa foi vista", async () => {
    const { api, buscar } = montar({ codigo: "RIFF-ABCDEF", amigos: [], recebidos: [], enviados: [], bloqueados: [] });
    await api.listas("t", "mania");
    expect(pedido(buscar).url).toBe("https://api/amigos?modo=mania");
  });

  it("conversa com o amigo: histórico paginado, envio, lidas e não lidas", async () => {
    let chamada = montar([]);
    await chamada.api.mensagens("t", "a", 40);
    expect(pedido(chamada.buscar)).toMatchObject({ url: "https://api/amigos/a/mensagens?antes=40", metodo: "GET" });
    chamada = montar({ id: 1, de: "eu", para: "a", texto: "oi", enviada_em: "2026-11-09T12:00:00Z" });
    expect((await chamada.api.enviarMensagem("t", "a", "oi")).id).toBe(1);
    expect(pedido(chamada.buscar)).toMatchObject({ url: "https://api/amigos/a/mensagens", metodo: "POST", corpo: '{"texto":"oi"}' });
    chamada = montar(null, 204);
    await chamada.api.marcarLidas("t", "a");
    expect(pedido(chamada.buscar)).toMatchObject({ url: "https://api/amigos/a/mensagens/lidas", metodo: "POST" });
    chamada = montar([{ conta_id: "a", quantas: 2 }]);
    expect(await chamada.api.naoLidas("t")).toEqual([{ conta_id: "a", quantas: 2 }]);
    expect(pedido(chamada.buscar).url).toBe("https://api/conversas/nao-lidas");
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
