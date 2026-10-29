import { cordasDaPista, layoutDaPista, projetar, xDaPista } from "./geometria";

describe("layoutDaPista", () => {
  it("no celular a pista ocupa quase a largura toda", () => {
    expect(layoutDaPista(400, 800).largura).toBeCloseTo(400 * 0.94);
  });

  it("no desktop a pista tem largura limitada", () => {
    expect(layoutDaPista(3000, 1000).largura).toBe(620);
  });

  it("o braço termina antes do topo da tela, para sumir num fade", () => {
    expect(layoutDaPista(1200, 800).horizonte).toBeGreaterThanOrEqual(800 * 0.15);
  });

  it("a pista fica deitada, como no Guitar Hero: sobe só até perto de um quarto da tela", () => {
    expect(layoutDaPista(1200, 800).horizonte).toBeGreaterThanOrEqual(800 * 0.25);
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

describe("cordasDaPista", () => {
  const layout = layoutDaPista(1200, 800);

  it("uma corda por traste, do meio da pista na linha de batida até o fim do braço", () => {
    const cordas = cordasDaPista(layout, 0);
    expect(cordas).toHaveLength(5);
    cordas.forEach((corda, pista) => {
      expect(corda.perto).toEqual({ x: xDaPista(layout, pista, 1), y: layout.linhaDeBatida });
      expect(corda.longe.y).toBeCloseTo(layout.horizonte);
      expect(corda.longe.x).toBeCloseTo(xDaPista(layout, pista, projetar(layout, 1).escala));
    });
  });

  it("as cordas graves (à esquerda) são mais grossas, como numa guitarra", () => {
    const [grave, , , , aguda] = cordasDaPista(layout, 0);
    expect(grave.espessura).toBeGreaterThan(aguda.espessura);
  });

  // As agudas lisas pareciam linhas soltas no braço: no jogo todas ganham o fio enrolado.
  it("todas as cordas são enroladas, com o mesmo acabamento", () => {
    expect(cordasDaPista(layout, 0).every((c) => c.enrolada)).toBe(true);
  });
});
