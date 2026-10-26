import { render, screen } from "@testing-library/react";
import { AvisoDeAcerto } from "./AvisoDeAcerto";

describe("AvisoDeAcerto", () => {
  it("mostra o julgamento do último acerto", () => {
    render(<AvisoDeAcerto julgamento={{ julgamento: "perfeito", tempo: 1 }} />);
    expect(screen.getByText("PERFEITO")).toBeInTheDocument();
  });

  it("não mostra nada antes do primeiro acerto", () => {
    const { container } = render(<AvisoDeAcerto julgamento={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("troca o texto a cada acerto novo", () => {
    const { rerender } = render(<AvisoDeAcerto julgamento={{ julgamento: "perfeito", tempo: 1 }} />);
    rerender(<AvisoDeAcerto julgamento={{ julgamento: "bom", tempo: 2 }} />);
    expect(screen.getByText("BOM")).toBeInTheDocument();
  });
});
