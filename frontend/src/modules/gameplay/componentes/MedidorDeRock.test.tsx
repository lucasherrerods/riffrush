import { render, screen } from "@testing-library/react";
import { MedidorDeRock } from "./MedidorDeRock";
import { PINOS_DO_STAR_POWER } from "../pinos";

describe("MedidorDeRock", () => {
  it("é um medidor da vida, de 0 a 100", () => {
    render(<MedidorDeRock vida={0.62} />);
    expect(screen.getByRole("meter", { name: "Vida" })).toHaveAttribute("aria-valuenow", "62");
  });

  it("usa a imagem do mostrador RIFF como moldura", () => {
    const { container } = render(<MedidorDeRock vida={0.5} />);
    expect(container.querySelector("image")).toHaveAttribute("href", expect.stringContaining("medidor-de-rock"));
  });

  it("no multijogador, mostra quando a vida zerou e o jogador virou fantasma", () => {
    const { rerender } = render(<MedidorDeRock vida={0} />);
    expect(screen.queryByLabelText("Virou fantasma")).not.toBeInTheDocument();
    rerender(<MedidorDeRock vida={0} fantasma />);
    expect(screen.getByLabelText("Virou fantasma")).toBeInTheDocument();
  });

  it.each([
    [0, 200],
    [0.5, 381],
    [1, 562],
  ])("com vida %f a barra fica acesa até x = %i, do vermelho ao verde", (vida, x) => {
    render(<MedidorDeRock vida={vida} />);
    expect(screen.getByTestId("barra-apagada")).toHaveAttribute("x", String(x));
  });

  it("os quatro pinos de cima enchem com o star power, um por quarto", () => {
    render(<MedidorDeRock vida={0.5} estrela={0.625} />);
    expect(screen.getByRole("progressbar", { name: "Star power" })).toHaveAttribute("aria-valuenow", "63");
    const pinos = screen.getAllByTestId("pino");
    expect(pinos).toHaveLength(PINOS_DO_STAR_POWER);
    expect(pinos.map((p) => p.getAttribute("data-progresso"))).toEqual(["1", "1", "0.5", "0"]);
  });

  it("cada pino pode receber o próprio progresso", () => {
    render(<MedidorDeRock vida={0.5} progressoDosPinos={[0, 1, 0.25, 0.75]} />);
    expect(screen.getAllByTestId("pino").map((p) => p.getAttribute("data-progresso"))).toEqual(["0", "1", "0.25", "0.75"]);
  });

  it("o líquido fica recortado no vidro de cada pino", () => {
    const { container } = render(<MedidorDeRock vida={0.5} estrela={1} />);
    const liquidos = screen.getAllByTestId("liquido");
    expect(liquidos).toHaveLength(PINOS_DO_STAR_POWER);
    for (const liquido of liquidos) {
      const id = liquido.getAttribute("clip-path")?.match(/url\(#(.+)\)/)?.[1];
      expect(container.querySelector(`clipPath[id="${id}"] polygon`)).toBeInTheDocument();
      expect(liquido).toHaveAttribute("href", expect.stringContaining("pinos-cheios"));
    }
  });

  it("a partir do segundo pino cheio, o azul de todos pulsa", () => {
    const { rerender } = render(<MedidorDeRock vida={0.5} estrela={0.45} />);
    expect(screen.getAllByTestId("liquido")[0]).not.toHaveClass("pulso-suave");
    rerender(<MedidorDeRock vida={0.5} estrela={0.5} />);
    for (const liquido of screen.getAllByTestId("liquido")) expect(liquido).toHaveClass("pulso-suave");
  });

  it("com o star power ligado, os pinos piscam", () => {
    render(<MedidorDeRock vida={0.5} estrela={0.8} estrelaAtiva />);
    expect(screen.getByRole("progressbar", { name: "Star power" })).toHaveClass("animate-pulse");
  });
});
