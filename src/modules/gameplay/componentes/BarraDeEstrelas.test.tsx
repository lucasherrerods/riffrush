import { render, screen } from "@testing-library/react";
import { BarraDeEstrelas } from "./BarraDeEstrelas";

const acesas = () => screen.getAllByTestId("estrela").filter((e) => e.dataset.acesa === "true").length;

describe("BarraDeEstrelas", () => {
  it("acende as estrelas já conquistadas e enche a barra até o progresso", () => {
    render(<BarraDeEstrelas progresso={2.5} />);
    expect(screen.getAllByTestId("estrela")).toHaveLength(5);
    expect(acesas()).toBe(2);
    expect(screen.getByRole("meter", { name: "Estrelas" })).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByTestId("preenchimento")).toHaveStyle({ height: "50%" });
  });

  it("marca na barra onde fica o recorde", () => {
    render(<BarraDeEstrelas progresso={1} recorde={4} />);
    expect(screen.getByLabelText("Recorde: 4 estrelas")).toHaveStyle({ bottom: "80%" });
  });

  it("sem recorde, não mostra a marca", () => {
    render(<BarraDeEstrelas progresso={1} />);
    expect(screen.queryByLabelText(/Recorde/)).not.toBeInTheDocument();
  });
});
