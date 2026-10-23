import { render, screen } from "@testing-library/react";
import { PainelDePontos } from "./PainelDePontos";

const base = { pontos: 12345, sequencia: 27, multiplicador: 3, precisao: 0.968, estrelaAtiva: false };

describe("PainelDePontos", () => {
  it("mostra pontos, combo, multiplicador e precisão", () => {
    render(<PainelDePontos {...base} />);
    expect(screen.getByLabelText("Pontos")).toHaveTextContent("012345");
    expect(screen.getByLabelText("Sequência")).toHaveTextContent("27");
    expect(screen.getByLabelText("Multiplicador")).toHaveTextContent("x3");
    expect(screen.getByLabelText("Precisão")).toHaveTextContent("97%");
  });

  it("os pontos aparecem num visor digital de 6 dígitos, como no arcade", () => {
    render(<PainelDePontos {...base} pontos={987} />);
    expect(screen.getByLabelText("Pontos")).toHaveTextContent(/^000987$/);
  });

  it("pontuação maior que o visor aparece inteira", () => {
    render(<PainelDePontos {...base} pontos={1234567} />);
    expect(screen.getByLabelText("Pontos")).toHaveTextContent(/^1234567$/);
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
