import { render, screen, waitFor } from "@testing-library/react";
import { criarApiDoRanking } from "./api";
import { PainelDoRankingDoMania } from "./PainelDoRankingDoMania";

const linha = { posicao: 1, partida_id: "p", conta_id: "c", nome: "Ana", avatar: null, pontuacao: 987654, precisao: 0.9912, maior_combo: 500, mods: 8, jogada_em: "2026-10-27T00:00:00Z", vale_ranking: true };

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
  await criarApiDoRanking("https://api.exemplo/", buscar).ranking(42, true);
  expect(buscar.mock.calls[1][0]).toBe("https://api.exemplo/mania/ranking/42?todas=true");
});

it("mostra também as partidas fora do ranking, marcadas e sem replay, e o filtro as esconde", async () => {
  const aoAssistir = vi.fn();
  const random = { ...linha, partida_id: "r", nome: "Caio", posicao: 2, vale_ranking: false };
  const buscar = vi.fn(async (_id: number, todas?: boolean) => (todas ? [linha, random] : [linha]));
  render(<PainelDoRankingDoMania beatmapId={42} buscar={buscar} aoAssistir={aoAssistir} />);
  expect(await screen.findByText("Caio")).toBeInTheDocument();
  expect(screen.getByText("fora do ranking")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Assistir ao replay de Caio" })).not.toBeInTheDocument();
  screen.getByRole("switch", { name: "Só as que valem ranking" }).click();
  await waitFor(() => expect(screen.queryByText("Caio")).not.toBeInTheDocument());
  expect(buscar).toHaveBeenLastCalledWith(42, false, expect.anything());
});

it("com onde assistir, cada linha do top 10 tem o botão do replay", async () => {
  const aoAssistir = vi.fn();
  const fora = { ...linha, partida_id: "q", nome: "Bia", posicao: 37 };
  render(<PainelDoRankingDoMania beatmapId={42} buscar={async () => [linha, fora]} aoAssistir={aoAssistir} />);
  (await screen.findByRole("button", { name: "Assistir ao replay de Ana" })).click();
  expect(aoAssistir).toHaveBeenCalledWith(linha);
  expect(screen.queryByRole("button", { name: "Assistir ao replay de Bia" })).not.toBeInTheDocument();
});

it("a api baixa o replay da partida em bytes", async () => {
  const buscar = vi.fn(async (_url: string | URL | Request) => new Response(new Uint8Array([1, 2, 3])));
  expect(await criarApiDoRanking("https://api.exemplo/", buscar).replay("p1")).toEqual(new Uint8Array([1, 2, 3]));
  expect(buscar.mock.calls[0][0]).toBe("https://api.exemplo/mania/partidas/p1/replay");
});
