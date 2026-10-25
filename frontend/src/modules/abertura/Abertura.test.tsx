import { render } from "@testing-library/react";
import { Abertura } from "./Abertura";

describe("Abertura", () => {
  it("sem canvas para desenhar, termina na hora e não prende o jogo", () => {
    const aoTerminar = vi.fn();
    render(<Abertura capas={[{ tipo: "gradiente", cores: ["#000", "#111"] }]} aoTerminar={aoTerminar} />);
    expect(aoTerminar).toHaveBeenCalledTimes(1);
  });

  it("sem capas, também termina na hora", () => {
    const aoTerminar = vi.fn();
    render(<Abertura capas={[]} aoTerminar={aoTerminar} />);
    expect(aoTerminar).toHaveBeenCalledTimes(1);
  });
});
