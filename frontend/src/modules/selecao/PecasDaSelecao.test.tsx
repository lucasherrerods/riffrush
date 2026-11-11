import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BotaoDeFavoritar, BotaoDeTocar, ChipsDeMods, FiltrosDaBiblioteca, RodapeDeComandos, TituloDaSelecao } from ".";

it("os chips de mods ligam pelo id", async () => {
  const aoAlternar = vi.fn();
  render(<ChipsDeMods mods={[{ id: "DT", sigla: "DT", nome: "Double Time", ligado: true }]} aoAlternar={aoAlternar} />);
  const chip = screen.getByRole("button", { name: "DT" });
  expect(chip).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(chip);
  expect(aoAlternar).toHaveBeenCalledWith("DT");
});

it("favoritar é um coração só de ícone, que troca o rótulo", () => {
  render(<BotaoDeFavoritar favorita aoAlternar={() => {}} />);
  const coracao = screen.getByRole("button", { name: "Tirar dos favoritos" });
  expect(coracao).toHaveAttribute("aria-pressed", "true");
  expect(coracao).toHaveTextContent("");
});

it("o título põe o favoritar no canto de cima da capa", () => {
  render(<TituloDaSelecao titulo="Riff" subtitulo="Banda" faixa={<img alt="" />} favoritar={<BotaoDeFavoritar favorita={false} aoAlternar={() => {}} />} />);
  expect(screen.getByRole("button", { name: "Favoritar" }).parentElement).toHaveClass("absolute", "top-2", "right-2");
});

it("tocar e treinar", async () => {
  const aoTocar = vi.fn();
  const aoTreinar = vi.fn();
  render(<BotaoDeTocar aoTocar={aoTocar} aoTreinar={aoTreinar} />);
  await userEvent.click(screen.getByRole("button", { name: /TOCAR/ }));
  await userEvent.click(screen.getByRole("button", { name: /Treinar/ }));
  expect(aoTocar).toHaveBeenCalled();
  expect(aoTreinar).toHaveBeenCalled();
});

it("o rodapé lista os atalhos", () => {
  render(<RodapeDeComandos comandos={[{ teclas: "Enter", rotulo: "Confirmar" }]} />);
  expect(screen.getByText("Enter")).toBeInTheDocument();
  expect(screen.getByText("Confirmar")).toBeInTheDocument();
});

it("os filtros da biblioteca buscam, ligam favoritos e sorteiam", async () => {
  const aoMudarTexto = vi.fn();
  const aoAlternarFavoritas = vi.fn();
  const aoSortear = vi.fn();
  render(
    <FiltrosDaBiblioteca
      texto=""
      aoMudarTexto={aoMudarTexto}
      placeholder="Buscar na biblioteca"
      rotuloDoCampo="Filtrar"
      ordens={[{ id: "titulo", rotulo: "Título" }]}
      ordem="titulo"
      aoMudarOrdem={() => {}}
      soFavoritas={false}
      aoAlternarFavoritas={aoAlternarFavoritas}
      aoSortear={aoSortear}
      podeSortear
      contagem="1 de 2 músicas"
    />,
  );
  await userEvent.type(screen.getByRole("searchbox", { name: "Filtrar" }), "a");
  await userEvent.click(screen.getByRole("button", { name: "Favoritos" }));
  await userEvent.click(screen.getByRole("button", { name: "Aleatório" }));
  expect(aoMudarTexto).toHaveBeenCalledWith("a");
  expect(aoAlternarFavoritas).toHaveBeenCalled();
  expect(aoSortear).toHaveBeenCalled();
  expect(screen.getByText("1 de 2 músicas")).toBeInTheDocument();
});

it("o título mostra a faixa acima do nome, quando houver", () => {
  render(<TituloDaSelecao titulo="White Prism" subtitulo="artista" faixa={<img alt="capa" src="capa.jpg" />} />);
  const faixa = screen.getByAltText("capa");
  const nome = screen.getByRole("heading", { name: "White Prism" });
  expect(faixa.compareDocumentPosition(nome) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

// Bug: com 10 mods o popover ficava largo como uma linha só e sobrava espaço vazio ao lado dos chips.
it("os mods ficam numa grade de no máximo 5 colunas, justa no conteúdo", () => {
  const mods = Array.from({ length: 10 }, (_, i) => ({ id: String(i), sigla: `M${i}`, nome: `Mod ${i}`, ligado: false }));
  render(<ChipsDeMods mods={mods} aoAlternar={() => {}} />);
  expect(screen.getByRole("group", { name: "Mods" }).style.gridTemplateColumns).toBe("repeat(5, auto)");
});
