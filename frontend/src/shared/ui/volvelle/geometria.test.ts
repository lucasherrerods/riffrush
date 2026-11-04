import { DURACAO_DO_GIRO_MS, geometriaDaVolvelle } from "./geometria";

describe("geometriaDaVolvelle", () => {
  it("põe o eixo no meio da borda de baixo da tela", () => {
    const g = geometriaDaVolvelle(1200, 800);
    expect(g.eixo).toEqual({ x: 600, y: 800 });
  });

  it("o raio cobre os cantos de cima, para o disco nunca deixar buraco ao girar", () => {
    for (const [largura, altura] of [[1200, 800], [390, 844], [2560, 1080]]) {
      const { raio } = geometriaDaVolvelle(largura, altura);
      expect(raio).toBeGreaterThanOrEqual(Math.hypot(largura / 2, altura));
    }
  });

  it("a cena ocupa a tela inteira dentro da metade de cima do disco", () => {
    const { raio, cena } = geometriaDaVolvelle(1000, 600);
    expect(cena).toEqual({ esquerda: raio - 500, topo: raio - 600, largura: 1000, altura: 600 });
  });

  it("o giro é rápido o bastante para não atrapalhar o jogo", () => {
    expect(DURACAO_DO_GIRO_MS).toBeLessThanOrEqual(1400);
  });
});
