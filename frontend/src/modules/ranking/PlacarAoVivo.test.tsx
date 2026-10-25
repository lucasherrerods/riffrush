import { render, screen, within } from "@testing-library/react";
import type { ApiDoRanking, PosicaoNoRanking } from "./api";
import { PlacarAoVivo } from "./PlacarAoVivo";

const posicao = (n: number, nome: string, pontos: number): PosicaoNoRanking => ({ posicao: n, nome, avatar: null, pontos, acertos: 1, total: 1, jogada_em: "", partida_id: `p${n}` });

const api = { buscar: vi.fn(async () => ({ jogadores: 3, top: [posicao(1, "Ana", 9000), posicao(2, "Bia", 5000), posicao(3, "Caio", 1000)], meu: null })) } satisfies Pick<ApiDoRanking, "buscar">;

const abrir = (pontos: number) => <PlacarAoVivo musicaId="encore:abc" dificuldade="expert" pontos={pontos} api={api} lerToken={() => null} />;

const linhas = () => within(screen.getByRole("list", { name: "Placar da música" })).getAllByRole("listitem");

beforeEach(() => api.buscar.mockClear());

describe("PlacarAoVivo", () => {
  it("mostra o ranking da música com você subindo conforme os pontos", async () => {
    const { rerender } = render(abrir(0));
    await screen.findByRole("list", { name: "Placar da música" });
    expect(linhas().at(-1)).toHaveTextContent("Você");
    rerender(abrir(6000));
    expect(linhas()[1]).toHaveTextContent("#2");
    expect(linhas()[1]).toHaveTextContent("Você");
    expect(linhas()[1]).toHaveTextContent("6.000");
  });

  it("busca o ranking uma vez só: os pontos mudando não refazem o pedido", async () => {
    const { rerender } = render(abrir(0));
    await screen.findByRole("list", { name: "Placar da música" });
    rerender(abrir(500));
    rerender(abrir(2000));
    expect(api.buscar).toHaveBeenCalledTimes(1);
  });

  it("ao ultrapassar alguém, a sua linha marca a ultrapassagem para a animação", async () => {
    const { rerender } = render(abrir(0));
    await screen.findByRole("list", { name: "Placar da música" });
    const voce = () => linhas().find((l) => l.textContent?.includes("Você"))!;
    expect(voce()).toHaveAttribute("data-ultrapassagens", "0");
    rerender(abrir(1500));
    expect(voce()).toHaveAttribute("data-ultrapassagens", "1");
    rerender(abrir(1600));
    expect(voce()).toHaveAttribute("data-ultrapassagens", "1");
    rerender(abrir(9500));
    expect(voce()).toHaveAttribute("data-ultrapassagens", "2");
  });

  it("sem conseguir carregar, não mostra nada para não atrapalhar a partida", async () => {
    render(<PlacarAoVivo musicaId="m" dificuldade="medio" pontos={0} api={{ buscar: vi.fn(async () => Promise.reject(new Error("x"))) }} lerToken={() => null} />);
    await new Promise((pronto) => setTimeout(pronto, 10));
    expect(screen.queryByRole("list", { name: "Placar da música" })).not.toBeInTheDocument();
  });
});
