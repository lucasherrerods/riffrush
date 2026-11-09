import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BotaoDeFavoritar, BotaoDeTocar, ChipsDeMods, FiltrosDaBiblioteca, RodapeDeComandos } from ".";

it("os chips de mods ligam pelo id", async () => {
  const aoAlternar = vi.fn();
  render(<ChipsDeMods mods={[{ id: "DT", sigla: "DT", nome: "Double Time", ligado: true }]} aoAlternar={aoAlternar} />);
  const chip = screen.getByRole("button", { name: "DT" });
  expect(chip).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(chip);
  expect(aoAlternar).toHaveBeenCalledWith("DT");
});

it("favoritar troca o rótulo", () => {
  render(<BotaoDeFavoritar favorita aoAlternar={() => {}} />);
  expect(screen.getByRole("button", { name: "Tirar dos favoritos" })).toHaveAttribute("aria-pressed", "true");
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
