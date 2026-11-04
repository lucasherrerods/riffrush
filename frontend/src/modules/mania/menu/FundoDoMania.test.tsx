import { render } from "@testing-library/react";
import { FundoDoMania } from "./FundoDoMania";

describe("FundoDoMania", () => {
  it("é só decoração: fica escondido dos leitores de tela", () => {
    const { container } = render(<FundoDoMania />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("tem as colunas do mania com notas e notas longas caindo até a linha de julgamento", () => {
    const { container } = render(<FundoDoMania />);
    expect(container.querySelectorAll("[data-parte='coluna']")).toHaveLength(7);
    expect(container.querySelectorAll("[data-parte='nota']").length).toBeGreaterThanOrEqual(7);
    expect(container.querySelectorAll("[data-parte='nota-longa']").length).toBeGreaterThan(0);
    expect(container.querySelector("[data-parte='julgamento']")).toBeInTheDocument();
  });

  it("tem um receptor para cada coluna, embaixo da linha de julgamento", () => {
    const { container } = render(<FundoDoMania />);
    expect(container.querySelectorAll("[data-parte='receptor']")).toHaveLength(7);
  });

  it("não tem os círculos de acerto do osu! padrão", () => {
    const { container } = render(<FundoDoMania />);
    expect(container.querySelector("[data-parte='aproximacao']")).not.toBeInTheDocument();
  });
});
