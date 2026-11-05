import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";
import { TelaDeSelecaoMania } from "./TelaDeSelecaoMania";

const mapa = (hash: string, teclas: number, dificuldade: string): DificuldadeSalva => ({
  hash,
  dificuldade,
  teclas,
  od: 8,
  hp: 7,
  notas: 300,
  notasLongas: 40,
  duracaoMs: 125_000,
  previaMs: 0,
  arquivoDeAudio: "a.mp3",
});
const conjunto = (id: string, titulo: string, mapas: DificuldadeSalva[]): ConjuntoSalvo =>
  ({ id, titulo, artista: `Artista ${titulo}`, mapper: "fulano", origem: "importado", mapas, usadoEm: 0 }) as ConjuntoSalvo;

const conjuntos = [conjunto("a", "Alfa", [mapa("a1", 4, "Easy"), mapa("a2", 7, "Hard")]), conjunto("b", "Beta", [mapa("b1", 4, "Normal")]), conjunto("c", "Gama", [mapa("c1", 7, "Insane")])];

const montar = (aoJogar = vi.fn()) => {
  render(<TelaDeSelecaoMania conjuntos={conjuntos} mods={0} aoMudarMods={vi.fn()} aoImportar={vi.fn()} aoJogar={aoJogar} />);
  return aoJogar;
};
const titulo = () => screen.getByRole("heading", { level: 2 }).textContent;

it("as setas andam pela roda dando a volta, e o Enter joga a dificuldade escolhida", () => {
  const aoJogar = montar();
  expect(titulo()).toBe("Alfa");
  fireEvent.keyDown(window, { code: "ArrowUp" });
  expect(titulo()).toBe("Gama");
  fireEvent.keyDown(window, { code: "ArrowDown" });
  fireEvent.keyDown(window, { code: "ArrowRight" });
  fireEvent.keyDown(window, { code: "Enter" });
  expect(aoJogar).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), expect.objectContaining({ hash: "a2" }));
});

it("Page Down pula vários mapas de uma vez sem dar a volta", () => {
  montar();
  fireEvent.keyDown(window, { code: "PageDown" });
  expect(titulo()).toBe("Gama");
  fireEvent.keyDown(window, { code: "PageUp" });
  expect(titulo()).toBe("Alfa");
});

it("a busca filtra a roda e a seleção vai para o que sobrou", async () => {
  montar();
  await userEvent.type(screen.getByRole("searchbox", { name: "Filtrar mapas" }), "gama");
  expect(titulo()).toBe("Gama");
  await userEvent.clear(screen.getByRole("searchbox", { name: "Filtrar mapas" }));
  await userEvent.type(screen.getByRole("searchbox", { name: "Filtrar mapas" }), "nada disso");
  expect(screen.getByText("Nenhum mapa com esse filtro.")).toBeInTheDocument();
});

it("o filtro de teclas esconde os mapas e as dificuldades das outras teclas", async () => {
  montar();
  await userEvent.click(screen.getByRole("radio", { name: "7K" }));
  expect(titulo()).toBe("Alfa");
  expect(screen.queryByText("Easy")).not.toBeInTheDocument();
  expect(screen.getByText("Hard")).toBeInTheDocument();
});

it("a aba de detalhes mostra os números da dificuldade", async () => {
  montar();
  await userEvent.click(screen.getByRole("tab", { name: /Detalhes/ }));
  expect(screen.getByText("2:05")).toBeInTheDocument();
  expect(screen.getByText("300")).toBeInTheDocument();
});
