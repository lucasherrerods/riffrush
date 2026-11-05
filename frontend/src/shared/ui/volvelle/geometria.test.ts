import { DURACAO_DO_GIRO_MS, curvaDoGiro, geometriaDaVolvelle, semiplanoDaCapa } from "./geometria";

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

describe("curvaDoGiro", () => {
  it("começa em 0, termina em 1 e passa pelo meio no meio, como o cubic-bezier do disco", () => {
    expect(curvaDoGiro(0)).toBe(0);
    expect(curvaDoGiro(1)).toBe(1);
    expect(curvaDoGiro(0.5)).toBeCloseTo(0.5, 3);
    expect(curvaDoGiro(0.1)).toBeLessThan(0.05);
  });
});

describe("semiplanoDaCapa", () => {
  it("parado, cobre tudo acima da linha do eixo", () => {
    expect(semiplanoDaCapa({ x: 500, y: 600 }, 2000, 0)).toBe("polygon(2500.0px 600.0px, 2500.0px -1400.0px, -1500.0px -1400.0px, -1500.0px 600.0px)");
  });

  it("meia volta depois, fica todo abaixo do eixo, fora da tela", () => {
    const ys = [...semiplanoDaCapa({ x: 500, y: 600 }, 2000, 180).matchAll(/px (-?[\d.]+)px/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeCloseTo(600, 0);
  });
});
