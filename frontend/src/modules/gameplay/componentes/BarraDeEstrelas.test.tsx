import { render, screen } from "@testing-library/react";
import { BarraDeEstrelas } from "./BarraDeEstrelas";

const estrelas = () => screen.queryAllByTestId("estrela");

describe("BarraDeEstrelas", () => {
  it("começa sem nenhuma estrela, carregando a primeira", () => {
    render(<BarraDeEstrelas progresso={0.5} />);
    expect(estrelas()).toHaveLength(0);
    expect(screen.getByTestId("trilho")).toHaveStyle({ height: "20%" });
    expect(screen.getByTestId("preenchimento")).toHaveStyle({ height: "10%" });
  });

  it("cada estrela aparece quando é alcançada, e o trilho vai até a próxima", () => {
    render(<BarraDeEstrelas progresso={2.5} />);
    expect(estrelas()).toHaveLength(2);
    expect(screen.getByRole("meter", { name: "Estrelas" })).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByTestId("trilho")).toHaveStyle({ height: "60%" });
  });

  it("com as 5 estrelas, o trilho fica cheio", () => {
    render(<BarraDeEstrelas progresso={5} />);
    expect(estrelas()).toHaveLength(5);
    expect(screen.getByTestId("trilho")).toHaveStyle({ height: "100%" });
  });

  it("o recorde é um tracinho sutil, mesmo na parte da barra que ainda não apareceu", () => {
    render(<BarraDeEstrelas progresso={1} recorde={4} />);
    expect(screen.getByLabelText("Recorde: 4 estrelas")).toHaveStyle({ bottom: "80%" });
  });

  it("sem recorde, não mostra o tracinho", () => {
    render(<BarraDeEstrelas progresso={1} />);
    expect(screen.queryByLabelText(/Recorde/)).not.toBeInTheDocument();
  });
});
