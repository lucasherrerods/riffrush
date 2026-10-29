import { render, screen } from "@testing-library/react";
import { MedidorCompacto } from "./MedidorCompacto";

describe("MedidorCompacto", () => {
  it("mostra a vida numa barra", () => {
    render(<MedidorCompacto vida={0.6} estrela={0} />);
    expect(screen.getByRole("meter", { name: "Vida" })).toHaveAttribute("aria-valuenow", "60");
  });

  it("enche os quatro pinos de azul conforme o star power", () => {
    render(<MedidorCompacto vida={1} estrela={0.5} />);
    expect(screen.getByRole("progressbar", { name: "Star power" })).toHaveAttribute("aria-valuenow", "50");
    const pinos = screen.getAllByTestId("pino");
    expect(pinos).toHaveLength(4);
    expect(pinos.map((p) => p.dataset.cheio)).toEqual(["1", "1", "0", "0"]);
  });
});
