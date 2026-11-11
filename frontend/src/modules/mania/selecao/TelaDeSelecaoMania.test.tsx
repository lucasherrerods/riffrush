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

it("abre já no conjunto pedido, como quando vem da busca", () => {
  render(<TelaDeSelecaoMania conjuntos={conjuntos} selecionado="c" mods={0} aoMudarMods={vi.fn()} aoImportar={vi.fn()} aoJogar={vi.fn()} />);
  expect(titulo()).toBe("Gama");
});

it("favorita com o botão ou a tecla F, e o filtro de favoritos deixa só elas na roda", async () => {
  localStorage.clear();
  montar();
  await userEvent.click(screen.getByRole("button", { name: "Favoritar" }));
  expect(screen.getByRole("button", { name: "Tirar dos favoritos" })).toHaveAttribute("aria-pressed", "true");
  expect(JSON.parse(localStorage.getItem("riffrush:mania:favoritas") ?? "[]")).toEqual(["a"]);
  await userEvent.click(screen.getByRole("button", { name: "Favoritos" }));
  expect(screen.queryByText(/\d+ de \d+ mapas?/)).not.toBeInTheDocument();
  fireEvent.keyDown(window, { code: "KeyF" });
  expect(screen.getByText("Nenhum mapa com esse filtro.")).toBeInTheDocument();
});

it("tem o botão de tocar e o rodapé com os atalhos, como no Rock", () => {
  montar();
  expect(screen.getByRole("button", { name: /TOCAR/ })).toBeInTheDocument();
  expect(screen.getByText("Confirmar")).toBeInTheDocument();
});

it("a Aleatória sorteia com as teclas do filtro e a seleção vai para o mapa que chega", async () => {
  const sortearMapa = vi.fn(async () => {});
  const props = { conjuntos, mods: 0, aoMudarMods: vi.fn(), aoImportar: vi.fn(), aoJogar: vi.fn(), sortearMapa };
  const { rerender } = render(<TelaDeSelecaoMania {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "Aleatória" }));
  expect(sortearMapa).toHaveBeenCalledWith("todas");
  rerender(<TelaDeSelecaoMania {...props} selecionado="c" />);
  expect(titulo()).toBe("Gama");
});

// Bug: o Esc não voltava ao menu na seleção do Mania.
it("o Esc volta para a tela anterior", () => {
  const aoVoltar = vi.fn();
  render(<TelaDeSelecaoMania conjuntos={conjuntos} mods={0} aoMudarMods={vi.fn()} aoImportar={vi.fn()} aoJogar={vi.fn()} aoVoltar={aoVoltar} />);
  fireEvent.keyDown(window, { code: "Escape" });
  expect(aoVoltar).toHaveBeenCalledOnce();
});

it("avisa o conjunto selecionado a cada troca, para o player tocar a música dele", () => {
  const aoMudarSelecao = vi.fn();
  render(<TelaDeSelecaoMania conjuntos={conjuntos} mods={0} aoMudarMods={vi.fn()} aoImportar={vi.fn()} aoJogar={vi.fn()} aoMudarSelecao={aoMudarSelecao} />);
  expect(aoMudarSelecao).toHaveBeenLastCalledWith("a");
  fireEvent.keyDown(window, { code: "ArrowDown" });
  expect(aoMudarSelecao).toHaveBeenLastCalledWith("b");
});

it("o menu de opções apaga o mapa selecionado depois de confirmar", async () => {
  const aoRemover = vi.fn();
  const usuario = userEvent.setup();
  render(<TelaDeSelecaoMania conjuntos={conjuntos} mods={0} aoMudarMods={vi.fn()} aoImportar={vi.fn()} aoJogar={vi.fn()} aoRemover={aoRemover} />);
  await usuario.click(screen.getByRole("button", { name: "Opções de Alfa" }));
  await usuario.click(screen.getByRole("menuitem", { name: /Apagar mapa/ }));
  await usuario.click(screen.getByRole("button", { name: "Remover" }));
  expect(aoRemover).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
});

it("com a confirmação aberta, o Enter não joga o mapa", async () => {
  const aoJogar = vi.fn();
  const usuario = userEvent.setup();
  render(<TelaDeSelecaoMania conjuntos={conjuntos} mods={0} aoMudarMods={vi.fn()} aoImportar={vi.fn()} aoJogar={aoJogar} aoRemover={vi.fn()} />);
  await usuario.click(screen.getByRole("button", { name: "Opções de Alfa" }));
  fireEvent.keyDown(window, { code: "Enter" });
  expect(aoJogar).not.toHaveBeenCalled();
});

it("os mods ficam num popover aberto pelo botão Modificadores", async () => {
  const aoMudarMods = vi.fn();
  const usuario = userEvent.setup();
  render(<TelaDeSelecaoMania conjuntos={conjuntos} mods={0} aoMudarMods={aoMudarMods} aoImportar={vi.fn()} aoJogar={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "HR" })).not.toBeInTheDocument();
  await usuario.click(screen.getByRole("button", { name: /Modificadores/ }));
  await usuario.click(screen.getByRole("button", { name: "HR" }));
  expect(aoMudarMods).toHaveBeenCalled();
});

describe("no celular", () => {
  beforeEach(() => Object.defineProperty(window, "innerWidth", { value: 375, configurable: true }));
  afterEach(() => Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true }));

  // No celular só se joga até 5K: o Gama (só 7K) some, o Alfa fica só com o 4K, e o filtro não oferece 7K.
  it("esconde as dificuldades de 6K para cima e os filtros delas", async () => {
    montar();
    expect(screen.queryByText("Gama")).not.toBeInTheDocument();
    expect(screen.queryByText("Hard")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    expect(screen.queryByRole("button", { name: "7K" })).not.toBeInTheDocument();
  });

  // Bug: detalhes, ranking e filtros empilhados deixavam a roda minúscula no celular.
  it("a roda fica com a tela: filtros recolhidos e detalhes na gaveta do rodapé", async () => {
    const aoJogar = montar();
    expect(screen.getByRole("list", { name: "Mapas" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Filtrar mapas" })).not.toBeInTheDocument();
    expect(screen.queryByText("Notas longas")).not.toBeInTheDocument();
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole("button", { name: /Filtros/ }));
    expect(screen.getByRole("searchbox", { name: "Filtrar mapas" })).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /Alfa/, expanded: false }));
    expect(screen.getByText("Notas longas")).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /TOCAR/ }));
    expect(aoJogar).toHaveBeenCalled();
  });
});
