import { render } from "@testing-library/react";
import { Fundo } from "./Fundo";

describe("Fundo", () => {
  it("anima partículas nos menus", () => {
    const { container } = render(<Fundo />);
    expect(container.querySelectorAll("[data-parte='particula']").length).toBeGreaterThan(0);
  });

  it("durante a música tira as partículas e para a grade, para sobrar desempenho para a pista", () => {
    const { container } = render(<Fundo tocando />);
    expect(container.querySelectorAll("[data-parte='particula']")).toHaveLength(0);
    expect(container.querySelector("[data-parte='grade']")).toHaveClass("grade-parada");
  });

  it("é só decoração: fica escondido dos leitores de tela", () => {
    const { container } = render(<Fundo />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("acende holofotes de palco que varrem o fundo dos menus", () => {
    const { container } = render(<Fundo />);
    const holofotes = container.querySelectorAll("[data-parte='holofote']");
    expect(holofotes.length).toBeGreaterThanOrEqual(3);
    for (const holofote of holofotes) expect(holofote).not.toHaveClass("holofote-parado");
  });

  it("durante a música os holofotes param de varrer, para não distrair da pista", () => {
    const { container } = render(<Fundo tocando />);
    for (const holofote of container.querySelectorAll("[data-parte='holofote']")) expect(holofote).toHaveClass("holofote-parado");
  });
});
