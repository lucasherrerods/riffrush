import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PosicaoNoGeral, RespostaDoGeral } from "./api";
import { TelaDeLeaderboard } from "./TelaDeLeaderboard";

const posicao = (n: number, nome: string, xp: number): PosicaoNoGeral => ({
  posicao: n,
  nome,
  avatar: null,
  xp_total: xp,
  nivel: { nivel: 10 - n, xp_no_nivel: 0, xp_para_o_proximo: 100 },
});

const ranking: RespostaDoGeral = { jogadores: 120, top: [posicao(1, "Ana", 9000), posicao(2, "Bia", 5000)], meu: posicao(87, "Lucas", 40) };

describe("TelaDeLeaderboard", () => {
  it("mostra o top por XP com o nível, e a própria posição fora do top embaixo", async () => {
    render(<TelaDeLeaderboard aoVoltar={() => {}} carregar={async () => ranking} />);

    const top = await screen.findByRole("list", { name: "Leaderboard" });
    expect(within(top).getAllByRole("listitem").map((l) => l.textContent)).toEqual([expect.stringContaining("Ana"), expect.stringContaining("Bia")]);
    expect(within(top).getByText("9.000 XP")).toBeInTheDocument();
    expect(within(top).getByText("Nv 9")).toBeInTheDocument();
    const minha = screen.getByRole("region", { name: "Sua posição" });
    expect(within(minha).getByText("#87")).toBeInTheDocument();
    expect(screen.getByText("Sua posição (#87 de 120)")).toBeInTheDocument();
  });

  it("quem já está no top não aparece de novo embaixo", async () => {
    render(<TelaDeLeaderboard aoVoltar={() => {}} carregar={async () => ({ ...ranking, meu: ranking.top[1] })} />);
    await screen.findByRole("list", { name: "Leaderboard" });
    expect(screen.queryByRole("region", { name: "Sua posição" })).not.toBeInTheDocument();
  });

  it("sem ninguém com XP, convida a jogar", async () => {
    render(<TelaDeLeaderboard aoVoltar={() => {}} carregar={async () => ({ jogadores: 0, top: [], meu: null })} />);
    expect(await screen.findByText(/Ninguém ganhou XP ainda/)).toBeInTheDocument();
  });

  it("se a API falha, deixa tentar de novo", async () => {
    const carregar = vi.fn().mockRejectedValueOnce(new Error("fora do ar")).mockResolvedValueOnce(ranking);
    render(<TelaDeLeaderboard aoVoltar={() => {}} carregar={carregar} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("list", { name: "Leaderboard" })).toBeInTheDocument();
  });

  it("voltar chama aoVoltar", async () => {
    const aoVoltar = vi.fn();
    render(<TelaDeLeaderboard aoVoltar={aoVoltar} carregar={async () => ranking} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Voltar" }));
    expect(aoVoltar).toHaveBeenCalled();
  });
});
