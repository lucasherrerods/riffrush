import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MusicaNoRanking, PosicaoNoGeral, RespostaDoGeral } from "./api";
import { TelaDeLeaderboard } from "./TelaDeLeaderboard";

const posicao = (n: number, nome: string, xp: number): PosicaoNoGeral => ({
  posicao: n,
  nome,
  avatar: null,
  xp_total: xp,
  nivel: { nivel: 10 - n, xp_no_nivel: 0, xp_para_o_proximo: 100 },
});

const ranking: RespostaDoGeral = { jogadores: 120, top: [posicao(1, "Ana", 9000), posicao(2, "Bia", 5000)], meu: posicao(87, "Lucas", 40) };

const musicas: MusicaNoRanking[] = [
  { posicao: 1, musica_id: "encore:abc", partidas: 30, jogadores: 4 },
  { posicao: 2, musica_id: "encore:xyz", partidas: 1, jogadores: 1 },
];

const tituloDaMusica = (id: string) => (id === "encore:abc" ? "Shine — Spektrem" : undefined);

function abrir(props: Partial<React.ComponentProps<typeof TelaDeLeaderboard>> = {}) {
  const carregarMusicas = vi.fn(async () => musicas);
  render(<TelaDeLeaderboard aoVoltar={() => {}} tituloDaMusica={tituloDaMusica} carregarPlayers={async () => ranking} carregarMusicas={carregarMusicas} {...props} />);
  return { carregarMusicas, usuario: userEvent.setup() };
}

describe("TelaDeLeaderboard", () => {
  it("abre na aba Players, com o top por XP e a própria posição fora do top embaixo", async () => {
    const { carregarMusicas } = abrir();

    expect(screen.getByRole("tab", { name: "Players" })).toHaveAttribute("aria-selected", "true");
    const top = await screen.findByRole("list", { name: "Players" });
    expect(within(top).getAllByRole("listitem").map((l) => l.textContent)).toEqual([expect.stringContaining("Ana"), expect.stringContaining("Bia")]);
    expect(within(top).getByText("9.000 XP")).toBeInTheDocument();
    expect(within(top).getByText("Nv 9")).toBeInTheDocument();
    expect(screen.getByText("Sua posição (#87 de 120)")).toBeInTheDocument();
    // A aba de músicas só pede à API quando é aberta.
    expect(carregarMusicas).not.toHaveBeenCalled();
  });

  it("quem já está no top não aparece de novo embaixo", async () => {
    abrir({ carregarPlayers: async () => ({ ...ranking, meu: ranking.top[1] }) });
    await screen.findByRole("list", { name: "Players" });
    expect(screen.queryByRole("region", { name: "Sua posição" })).not.toBeInTheDocument();
  });

  it("a aba Músicas mostra as mais jogadas com partidas e jogadores", async () => {
    const { usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: "Músicas" }));

    const lista = await screen.findByRole("list", { name: "Músicas" });
    const [primeira, segunda] = within(lista).getAllByRole("listitem");
    expect(primeira).toHaveTextContent("Shine — Spektrem");
    expect(primeira).toHaveTextContent("4 jogadores");
    expect(primeira).toHaveTextContent("30 partidas");
    // Música que não está na biblioteca aparece pelo id, no singular quando é uma só.
    expect(segunda).toHaveTextContent("encore:xyz");
    expect(segunda).toHaveTextContent("1 jogador");
    expect(segunda).toHaveTextContent("1 partida");
  });

  it("sem dados, cada aba explica o que falta", async () => {
    const { usuario } = abrir({ carregarPlayers: async () => ({ jogadores: 0, top: [], meu: null }), carregarMusicas: async () => [] });
    expect(await screen.findByText(/Ninguém ganhou XP ainda/)).toBeInTheDocument();
    await usuario.click(screen.getByRole("tab", { name: "Músicas" }));
    expect(await screen.findByText("Nenhuma música foi jogada ainda.")).toBeInTheDocument();
  });

  it("se a API falha, deixa tentar de novo", async () => {
    const carregarPlayers = vi.fn().mockRejectedValueOnce(new Error("fora do ar")).mockResolvedValueOnce(ranking);
    const { usuario } = abrir({ carregarPlayers });
    await usuario.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("list", { name: "Players" })).toBeInTheDocument();
  });

  it("voltar chama aoVoltar", async () => {
    const aoVoltar = vi.fn();
    const { usuario } = abrir({ aoVoltar });
    await usuario.click(screen.getByRole("button", { name: "Voltar" }));
    expect(aoVoltar).toHaveBeenCalled();
  });
});
