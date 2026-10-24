import { criarApiDoRanking } from "./api";

const resposta = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200 });

describe("criarApiDoRanking", () => {
  it("pede o ranking da música e da dificuldade, com o id codificado na URL", async () => {
    const buscar = vi.fn(async () => resposta({ jogadores: 0, top: [], meu: null }));
    await criarApiDoRanking("http://api", buscar).buscar("arquivo:Banda - Hit.sng:12", "expert");
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api/ranking?musica_id=arquivo%3ABanda+-+Hit.sng%3A12&dificuldade=expert");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("com token, manda o token para vir o recorde pessoal", async () => {
    const buscar = vi.fn(async () => resposta({ jogadores: 0, top: [], meu: null }));
    await criarApiDoRanking("http://api", buscar).buscar("m", "medio", { token: "tok" });
    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });
});
