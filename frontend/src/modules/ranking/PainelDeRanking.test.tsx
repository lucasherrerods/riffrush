import { act, render, screen, within } from "@testing-library/react";
import type { ApiDoRanking, PosicaoNoRanking, RespostaDoRanking } from "./api";
import { PainelDeRanking } from "./PainelDeRanking";

const posicao = (n: number, nome: string, pontos: number): PosicaoNoRanking => ({
  posicao: n,
  nome,
  avatar: null,
  pontos,
  acertos: 9948,
  total: 10000,
  precisao: 0.9735,
  maior_sequencia: null,
  jogada_em: new Date().toISOString(),
  partida_id: `partida-${n}`,
});

function apiCom(resposta: RespostaDoRanking | Promise<RespostaDoRanking>) {
  return { buscar: vi.fn(async () => resposta) } satisfies Pick<ApiDoRanking, "buscar">;
}

function abrir(api: Pick<ApiDoRanking, "buscar">, { musicaId = "encore:abc", dificuldade = "expert" as const, token = null as string | null } = {}) {
  return render(<PainelDeRanking musicaId={musicaId} dificuldade={dificuldade} api={api} atrasoMs={0} lerToken={() => token} />);
}

describe("PainelDeRanking", () => {
  it("clicar numa linha abre a partida dela", async () => {
    const aoAbrirPartida = vi.fn();
    render(
      <PainelDeRanking
        musicaId="encore:abc"
        dificuldade="expert"
        api={apiCom({ jogadores: 1, top: [posicao(1, "Srr 4", 1_099_340)], meu: null })}
        atrasoMs={0}
        lerToken={() => null}
        aoAbrirPartida={aoAbrirPartida}
      />,
    );
    (await screen.findByRole("button", { name: "Ver a partida de Srr 4" })).click();
    expect(aoAbrirPartida).toHaveBeenCalledWith("partida-1");
  });

  it("lista o top com posição, nome, precisão e pontos", async () => {
    abrir(apiCom({ jogadores: 2, top: [posicao(1, "Srr 4", 1_099_340), posicao(2, "Cohue", 1_043_725)], meu: null }));
    const lista = await screen.findByRole("list", { name: "Ranking" });
    const linhas = within(lista).getAllByRole("listitem");
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent("#1");
    expect(linhas[0]).toHaveTextContent("Srr 4");
    expect(linhas[0]).toHaveTextContent("97,35%");
    expect(linhas[0]).toHaveTextContent("1.099.340");
  });

  it("cada linha mostra a nota da precisão, como no osu!mania", async () => {
    abrir(apiCom({ jogadores: 2, top: [{ ...posicao(1, "Srr 4", 10), precisao: 1 }, posicao(2, "Cohue", 9)], meu: null }));
    const linhas = within(await screen.findByRole("list", { name: "Ranking" })).getAllByRole("listitem");
    expect(within(linhas[0]).getByLabelText("Nota SS")).toBeInTheDocument();
    expect(within(linhas[1]).getByLabelText("Nota S")).toBeInTheDocument();
  });

  it("mostra o recorde pessoal com a posição entre todos, mesmo fora do top", async () => {
    abrir(apiCom({ jogadores: 928, top: [posicao(1, "Srr 4", 1_099_340)], meu: posicao(578, "Lucas", 380_146) }), { token: "tok" });
    const meu = await screen.findByRole("region", { name: "Recorde pessoal" });
    expect(meu).toHaveTextContent("Recorde pessoal (#578 de 928)");
    expect(meu).toHaveTextContent("380.146");
  });

  it("logado, pede o ranking com o token", async () => {
    const api = apiCom({ jogadores: 0, top: [], meu: null });
    abrir(api, { token: "tok" });
    await screen.findByText(/Ninguém terminou/);
    expect(api.buscar).toHaveBeenCalledWith("encore:abc", "expert", expect.objectContaining({ token: "tok" }));
  });

  it("pede pelos pontos e, com a ordem por precisão, pede por precisão", async () => {
    const api = apiCom({ jogadores: 0, top: [], meu: null });
    const { rerender } = abrir(api);
    await screen.findByText(/Ninguém terminou/);
    expect(api.buscar).toHaveBeenLastCalledWith("encore:abc", "expert", expect.objectContaining({ ordem: "pontos" }));
    rerender(<PainelDeRanking musicaId="encore:abc" dificuldade="expert" api={api} atrasoMs={0} lerToken={() => null} ordem="precisao" />);
    await vi.waitFor(() => expect(api.buscar).toHaveBeenLastCalledWith("encore:abc", "expert", expect.objectContaining({ ordem: "precisao" })));
  });

  it("sem ninguém no ranking, convida a ser o primeiro", async () => {
    abrir(apiCom({ jogadores: 0, top: [], meu: null }));
    expect(await screen.findByText("Ninguém terminou esta música nesta dificuldade ainda. Seja o primeiro!")).toBeInTheDocument();
  });

  it("avisa quando não consegue carregar", async () => {
    abrir({ buscar: vi.fn(async () => Promise.reject(new Error("sem rede"))) });
    expect(await screen.findByRole("alert")).toHaveTextContent("Não deu para carregar o ranking.");
  });

  // Girar o carrossel passa por várias músicas: só a última, onde a seleção parou, vale.
  it("trocando de música, a resposta atrasada da anterior não aparece", async () => {
    let responderAntiga = (_: RespostaDoRanking) => {};
    const api = {
      buscar: vi.fn((musicaId: string) =>
        musicaId === "antiga"
          ? new Promise<RespostaDoRanking>((resolver) => (responderAntiga = resolver))
          : Promise.resolve({ jogadores: 1, top: [posicao(1, "Da Nova", 10)], meu: null }),
      ),
    } satisfies Pick<ApiDoRanking, "buscar">;
    const { rerender } = abrir(api, { musicaId: "antiga" });
    rerender(<PainelDeRanking musicaId="nova" dificuldade="expert" api={api} atrasoMs={0} lerToken={() => null} />);
    expect(await screen.findByText("Da Nova")).toBeInTheDocument();
    await act(async () => responderAntiga({ jogadores: 1, top: [posicao(1, "Da Antiga", 99)], meu: null }));
    expect(screen.queryByText("Da Antiga")).not.toBeInTheDocument();
  });
});
