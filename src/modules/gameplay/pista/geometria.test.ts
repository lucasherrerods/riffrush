import { layoutDaPista, projetar, xDaPista } from "./geometria";

describe("layoutDaPista", () => {
  it("no celular a pista ocupa quase a largura toda", () => {
    expect(layoutDaPista(400, 800).largura).toBeCloseTo(400 * 0.94);
  });

  it("no desktop a pista tem largura limitada", () => {
    expect(layoutDaPista(3000, 1000).largura).toBe(620);
  });

  it("divide a pista em 5 trastes iguais", () => {
    const layout = layoutDaPista(1200, 800);
    expect(layout.larguraDoTraste * 5).toBeCloseTo(layout.largura);
  });
});

describe("projetar", () => {
  const layout = layoutDaPista(1200, 800);

  it("na linha de batida a escala é 1", () => {
    expect(projetar(layout, 0)).toEqual({ y: layout.linhaDeBatida, escala: 1 });
  });

  it("no fundo a nota fica no horizonte e bem menor", () => {
    const fundo = projetar(layout, 1);
    expect(fundo.y).toBeCloseTo(layout.horizonte);
    expect(fundo.escala).toBeLessThan(0.3);
  });

  it("quanto mais longe, mais alto e menor", () => {
    const perto = projetar(layout, 0.2);
    const longe = projetar(layout, 0.6);
    expect(longe.y).toBeLessThan(perto.y);
    expect(longe.escala).toBeLessThan(perto.escala);
  });
});

describe("xDaPista", () => {
  const layout = layoutDaPista(1200, 800);

  it("o traste do meio fica no centro da tela", () => {
    expect(xDaPista(layout, 2, 1)).toBe(600);
  });

  it("os trastes se aproximam do centro com a distância", () => {
    expect(Math.abs(xDaPista(layout, 0, 0.5) - 600)).toBeCloseTo(Math.abs(xDaPista(layout, 0, 1) - 600) / 2);
  });
});
