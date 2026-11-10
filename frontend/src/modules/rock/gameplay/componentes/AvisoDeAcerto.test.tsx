import { render, screen } from "@testing-library/react";
import { AvisoDeAcerto } from "./AvisoDeAcerto";

describe("AvisoDeAcerto", () => {
  it("mostra o julgamento do último acerto", () => {
    render(<AvisoDeAcerto julgamento={{ julgamento: "max", tempo: 1 }} />);
    expect(screen.getByText("MAX")).toBeInTheDocument();
  });

  it("não mostra nada antes do primeiro acerto", () => {
    const { container } = render(<AvisoDeAcerto julgamento={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("troca o texto a cada acerto novo", () => {
    const { rerender } = render(<AvisoDeAcerto julgamento={{ julgamento: "max", tempo: 1 }} />);
    rerender(<AvisoDeAcerto julgamento={{ julgamento: "j50", tempo: 2 }} />);
    expect(screen.getByText("50")).toBeInTheDocument();
  });
});
