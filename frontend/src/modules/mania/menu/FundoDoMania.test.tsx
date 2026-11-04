import { render } from "@testing-library/react";
import { FundoDoMania } from "./FundoDoMania";

describe("FundoDoMania", () => {
  it("é só decoração: fica escondido dos leitores de tela", () => {
    const { container } = render(<FundoDoMania />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("tem os triângulos subindo e os círculos de acerto pulsando, como no osu!", () => {
    const { container } = render(<FundoDoMania />);
    expect(container.querySelectorAll("[data-parte='triangulo']").length).toBeGreaterThanOrEqual(8);
    expect(container.querySelectorAll("[data-parte='aproximacao']").length).toBeGreaterThan(0);
  });

  it("desenha as colunas do mania convergindo no chão", () => {
    const { container } = render(<FundoDoMania />);
    expect(container.querySelectorAll("[data-parte='coluna']").length).toBe(7);
  });
});
