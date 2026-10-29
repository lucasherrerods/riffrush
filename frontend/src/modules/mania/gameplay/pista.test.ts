import { geometriaDaPista, notasVisiveis, yDaNota } from "./pista";

describe("geometriaDaPista", () => {
  it("centraliza as colunas e põe a linha de julgamento perto da base", () => {
    const g = geometriaDaPista(1000, 800, 4);
    expect(g.larguraDaColuna).toBe(80);
    expect(g.x).toBe(340);
    expect(g.yDoJulgamento).toBe(680);
  });

  it("muitas colunas encolhem para caber na tela", () => {
    const g = geometriaDaPista(400, 800, 10);
    expect(g.larguraDaColuna * 10).toBeLessThanOrEqual(400 * 0.94);
    expect(g.x).toBeGreaterThanOrEqual(0);
  });
});

describe("yDaNota", () => {
  it("a nota chega na linha de julgamento no tempo dela e sai do topo na antecedência da rolagem", () => {
    expect(yDaNota(2000, 2000, 500, 600)).toBe(600);
    expect(yDaNota(2500, 2000, 500, 600)).toBe(0);
    expect(yDaNota(2250, 2000, 500, 600)).toBe(300);
    expect(yDaNota(1900, 2000, 500, 600)).toBe(720);
  });
});

it("notasVisiveis devolve só as que estão na tela agora, incluindo notas longas em curso", () => {
  // Trios [coluna, tempo, fim].
  const notas = [0, 100, -1, 1, 900, -1, 2, 1000, 3000, 3, 5000, -1];
  expect(notasVisiveis(notas, 2000, 500, 200)).toEqual([2]);
  expect(notasVisiveis(notas, 950, 500, 200)).toEqual([1, 2]);
});
