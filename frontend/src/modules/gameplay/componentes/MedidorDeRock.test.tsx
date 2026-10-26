import { render, screen } from "@testing-library/react";
import { MedidorDeRock } from "./MedidorDeRock";

const angulo = () => screen.getByTestId("ponteiro").getAttribute("transform");

describe("MedidorDeRock", () => {
  it("é um medidor da vida, de 0 a 100", () => {
    render(<MedidorDeRock vida={0.62} />);
    expect(screen.getByRole("meter", { name: "Vida" })).toHaveAttribute("aria-valuenow", "62");
  });

  it("usa a imagem do mostrador com válvulas como moldura", () => {
    const { container } = render(<MedidorDeRock vida={0.5} />);
    expect(container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("medidor-de-rock"));
  });

  it("no multijogador, mostra quando a vida zerou e o jogador virou fantasma", () => {
    const { rerender } = render(<MedidorDeRock vida={0} />);
    expect(screen.queryByLabelText("Virou fantasma")).not.toBeInTheDocument();
    rerender(<MedidorDeRock vida={0} fantasma />);
    expect(screen.getByLabelText("Virou fantasma")).toBeInTheDocument();
  });

  it.each([
    [0, -50],
    [0.5, 0],
    [1, 50],
  ])("com vida %f o ponteiro aponta %i graus, do vermelho ao verde", (vida, graus) => {
    render(<MedidorDeRock vida={vida} />);
    expect(angulo()).toContain(`rotate(${graus}`);
  });
});
