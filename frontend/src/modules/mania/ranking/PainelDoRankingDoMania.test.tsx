import { render, screen } from "@testing-library/react";
import { criarApiDoRanking } from "./api";
import { PainelDoRankingDoMania } from "./PainelDoRankingDoMania";

const linha = { posicao: 1, partida_id: "p", conta_id: "c", nome: "Ana", avatar: null, pontuacao: 987654, precisao: 0.9912, maior_combo: 500, mods: 8, jogada_em: "2026-10-27T00:00:00Z" };

it("mostra o top da dificuldade com mods, precisão e pontuação", async () => {
  render(<PainelDoRankingDoMania beatmapId={42} buscar={async () => [linha]} />);
  expect(await screen.findByText("Ana")).toBeInTheDocument();
  expect(screen.getByText("HR")).toBeInTheDocument();
  expect(screen.getByText("99,12%")).toBeInTheDocument();
  expect(screen.getByText("987.654")).toBeInTheDocument();
});

it("ranking vazio convida a jogar, e erro avisa", async () => {
  const { unmount } = render(<PainelDoRankingDoMania beatmapId={1} buscar={async () => []} />);
  expect(await screen.findByText(/Ninguém jogou ainda/)).toBeInTheDocument();
  unmount();
  render(<PainelDoRankingDoMania beatmapId={1} buscar={async () => Promise.reject(new Error("x"))} />);
  expect(await screen.findByText(/Não foi possível/)).toBeInTheDocument();
});

it("a api pede a rota do Mania", async () => {
  const buscar = vi.fn(async (_url: string | URL | Request) => new Response(JSON.stringify({ linhas: [linha] })));
  expect(await criarApiDoRanking("https://api.exemplo/", buscar).ranking(42)).toEqual([linha]);
  expect(buscar.mock.calls[0][0]).toBe("https://api.exemplo/mania/ranking/42");
});
