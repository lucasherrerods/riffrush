import { render, screen } from "@testing-library/react";
import { BarraDeDesvio, GraficoDaPrecisao, textoDoUr } from "./GraficosDaPartida";

it("o gráfico da precisão desenha uma linha com um ponto por amostra", () => {
  render(<GraficoDaPrecisao curva={[1, 0.9, 0.95]} />);
  const grafico = screen.getByRole("img", { name: "Precisão ao longo da música" });
  expect(grafico.querySelector("polyline")?.getAttribute("points")?.trim().split(" ")).toHaveLength(3);
});

it("sem amostras o gráfico não aparece", () => {
  const { container } = render(<GraficoDaPrecisao curva={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it("a barra de desvio mostra a média, se foi cedo ou tarde, e o UR", () => {
  render(<BarraDeDesvio histograma={[0, 2, 5, 1]} mediaMs={-3.4} ur={87.26} />);
  expect(screen.getByText("3,4 ms cedo")).toBeInTheDocument();
  expect(screen.getByText("UR 87,3")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Desvio dos toques" }).querySelectorAll("rect")).toHaveLength(4);
});

it("com a média tarde avisa tarde", () => {
  render(<BarraDeDesvio histograma={[1]} mediaMs={2} ur={10} />);
  expect(screen.getByText("2,0 ms tarde")).toBeInTheDocument();
});

it("sem toques a barra não aparece", () => {
  const { container } = render(<BarraDeDesvio histograma={[0, 0]} mediaMs={0} ur={0} />);
  expect(container).toBeEmptyDOMElement();
});

it("escreve o UR com uma casa e vírgula", () => {
  expect(textoDoUr(87.26)).toBe("UR 87,3");
});
