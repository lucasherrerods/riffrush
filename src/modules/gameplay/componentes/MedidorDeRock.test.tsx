import { render, screen } from "@testing-library/react";
import { MedidorDeRock } from "./MedidorDeRock";

const angulo = () => screen.getByTestId("ponteiro").getAttribute("transform");

describe("MedidorDeRock", () => {
  it("é um medidor da vida, de 0 a 100", () => {
    render(<MedidorDeRock vida={0.62} />);
    expect(screen.getByRole("meter", { name: "Vida" })).toHaveAttribute("aria-valuenow", "62");
    expect(screen.getByText("ROCK")).toBeInTheDocument();
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
