import { criarApiDoRanking } from "./api";

const resposta = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200 });

describe("criarApiDoRanking", () => {
  it("pede o ranking da música e da dificuldade, com o id codificado na URL", async () => {
    const buscar = vi.fn(async () => resposta({ jogadores: 0, top: [], meu: null }));
    await criarApiDoRanking("http://api", buscar).buscar("arquivo:Banda - Hit.sng:12", "expert");
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api/ranking?musica_id=arquivo%3ABanda+-+Hit.sng%3A12&dificuldade=expert&instrumento=guitarra");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("pede o ranking do instrumento escolhido", async () => {
    const buscar = vi.fn(async () => resposta({ jogadores: 0, top: [], meu: null }));
    await criarApiDoRanking("http://api", buscar).buscar("m", "medio", { instrumento: "baixo" });
    expect(buscar.mock.calls[0] as unknown as [string]).toEqual([expect.stringContaining("instrumento=baixo"), expect.anything()]);
  });

  it("com token, manda o token para vir o recorde pessoal", async () => {
    const buscar = vi.fn(async () => resposta({ jogadores: 0, top: [], meu: null }));
    await criarApiDoRanking("http://api", buscar).buscar("m", "medio", { token: "tok" });
    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });

  it("recusa uma resposta fora do formato, para o painel mostrar o erro em vez de quebrar a tela", async () => {
    for (const corpo of [{}, { jogadores: 1, top: null, meu: null }, "<html>", null]) {
      const api = criarApiDoRanking("http://api", async () => resposta(corpo));
      await expect(api.buscar("m", "medio")).rejects.toThrow("formato");
    }
  });

  it("o geral é um GET em /ranking/geral com o token, quando há", async () => {
    const buscar = vi.fn(async () => resposta({ jogadores: 1, top: [], meu: null }));
    expect(await criarApiDoRanking("http://api", buscar).geral({ token: "tok" })).toEqual({ jogadores: 1, top: [], meu: null });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api/ranking/geral");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });

  it("as músicas mais jogadas são um GET em /ranking/musicas, e formato estranho vira erro", async () => {
    const buscar = vi.fn(async () => resposta([{ posicao: 1, musica_id: "m", partidas: 3, jogadores: 2 }]));
    expect(await criarApiDoRanking("http://api", buscar).musicas()).toHaveLength(1);
    expect((buscar.mock.calls[0] as unknown as [string])[0]).toBe("http://api/ranking/musicas");
    await expect(criarApiDoRanking("http://api", async () => resposta({ erro: 1 })).musicas()).rejects.toThrow();
  });
});

describe("partida do ranking", () => {
  it("busca a partida pelo id", async () => {
    const buscar = vi.fn(async () => new Response(JSON.stringify({ id: "p1", nome: "Srr 4", pontos: 10 }), { status: 200 }));
    const api = criarApiDoRanking("https://api.teste", buscar as unknown as typeof fetch);
    expect(await api.partida("p1")).toMatchObject({ id: "p1", nome: "Srr 4" });
    expect(String((buscar.mock.calls[0] as unknown[])[0])).toBe("https://api.teste/partidas/p1");
  });
});
