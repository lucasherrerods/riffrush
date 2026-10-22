import { render, screen } from "@testing-library/react";
import { PainelDePontos } from "./PainelDePontos";

const base = { pontos: 12345, sequencia: 27, multiplicador: 3, precisao: 0.968, estrelaAtiva: false };

describe("PainelDePontos", () => {
  it("mostra pontos, combo, multiplicador e precisão", () => {
    render(<PainelDePontos {...base} />);
    expect(screen.getByLabelText("Pontos")).toHaveTextContent("12.345");
    expect(screen.getByLabelText("Sequência")).toHaveTextContent("27");
    expect(screen.getByLabelText("Multiplicador")).toHaveTextContent("3x");
    expect(screen.getByLabelText("Precisão")).toHaveTextContent("97%");
  });

  it("mostra quanto falta para o próximo multiplicador", () => {
    render(<PainelDePontos {...base} />);
    expect(screen.getByRole("progressbar", { name: "Próximo multiplicador" })).toHaveAttribute("aria-valuenow", "70");
  });

  it("no modo compacto continua mostrando os quatro números", () => {
    render(<PainelDePontos {...base} compacto />);
    for (const rotulo of ["Pontos", "Sequência", "Multiplicador", "Precisão"]) expect(screen.getByLabelText(rotulo)).toBeInTheDocument();
  });
});
