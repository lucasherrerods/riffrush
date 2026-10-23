import { render, screen } from "@testing-library/react";
import { MedidorDeRock } from "./MedidorDeRock";

const angulo = () => screen.getByTestId("ponteiro").getAttribute("transform");

describe("MedidorDeRock", () => {
  it("é um medidor da vida, de 0 a 100", () => {
    render(<MedidorDeRock vida={0.62} />);
    expect(screen.getByRole("meter", { name: "Vida" })).toHaveAttribute("aria-valuenow", "62");
    expect(screen.getByText("ROCK")).toBeInTheDocument();
  });

  it("o mostrador também tem a camada de sujeira", () => {
    render(<MedidorDeRock vida={0.5} />);
    expect(screen.getByRole("meter", { name: "Vida" })).toHaveClass("sujeira");
  });

  it("no multijogador, mostra quando a vida zerou e o jogador virou fantasma", () => {
    const { rerender } = render(<MedidorDeRock vida={0} />);
    expect(screen.queryByLabelText("Virou fantasma")).not.toBeInTheDocument();
    rerender(<MedidorDeRock vida={0} fantasma />);
    expect(screen.getByLabelText("Virou fantasma")).toBeInTheDocument();
  });

  it("tem as válvulas em cima, como um amplificador", () => {
    render(<MedidorDeRock vida={0.5} />);
    expect(screen.getAllByTestId("valvula")).toHaveLength(3);
  });

  it.each([
    [0, -80],
    [0.5, 0],
    [1, 80],
  ])("com vida %f o ponteiro aponta %i graus", (vida, graus) => {
    render(<MedidorDeRock vida={vida} />);
    expect(angulo()).toContain(`rotate(${graus}`);
  });
});
