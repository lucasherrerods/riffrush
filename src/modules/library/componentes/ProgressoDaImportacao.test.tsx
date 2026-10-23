import { render, screen } from "@testing-library/react";
import { ProgressoDaImportacao } from "./ProgressoDaImportacao";

describe("ProgressoDaImportacao", () => {
  it("mostra a barra, o arquivo atual e quantos faltam", () => {
    render(<ProgressoDaImportacao progresso={{ fracao: 0.5, concluidos: 1, total: 3, atual: "Banda - Hit.sng" }} />);
    expect(screen.getByRole("progressbar", { name: /Importando/ })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("Banda - Hit.sng")).toBeInTheDocument();
    expect(screen.getByText("2 de 3")).toBeInTheDocument();
  });

  it("sem importação, não mostra nada", () => {
    const { container } = render(<ProgressoDaImportacao progresso={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
