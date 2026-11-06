import { layoutDaPista } from "./geometria";
import { faixasDaHighway } from "./highway";

const layout = layoutDaPista(1600, 900);

describe("faixasDaHighway", () => {
  it("cobre o braço da linha de batida até o horizonte, sem buracos", () => {
    const faixas = faixasDaHighway(layout, 0, 1, 1024, 0, 20);
    expect(faixas[0].y + faixas[0].altura).toBeCloseTo(layout.linhaDeBatida, 0);
    expect(faixas.at(-1)!.y).toBeCloseTo(layout.horizonte, 0);
    for (let i = 1; i < faixas.length; i++) expect(faixas[i].y + faixas[i].altura).toBeGreaterThanOrEqual(faixas[i - 1].y - 0.01);
  });

  it("estica a imagem na largura do braço, que afina com a distância", () => {
    const faixas = faixasDaHighway(layout, 0, 1, 1024, 0, 20);
    expect(faixas[0].largura).toBeCloseTo(layout.largura, 0);
    expect(faixas.at(-1)!.largura).toBeLessThan(faixas[0].largura);
    expect(faixas[0].x).toBeCloseTo(layout.centro - layout.largura / 2, 0);
  });

  it("corre junto com as notas: meio segundo depois, a imagem desceu meio braço", () => {
    const antes = faixasDaHighway(layout, 0, 1, 1024, 0, 2);
    const depois = faixasDaHighway(layout, 0.5, 1, 1024, 0, 2);
    expect((depois[0].origem - antes[0].origem + 1024) % 1024).toBeCloseTo(512, 0);
  });

  it("repete a imagem: a origem nunca sai dela", () => {
    for (const tempo of [0, 3.7, 100.2]) {
      for (const faixa of faixasDaHighway(layout, tempo, 1, 1024, 0, 30)) {
        expect(faixa.origem).toBeGreaterThanOrEqual(0);
        expect(faixa.origem + faixa.alturaDaOrigem).toBeLessThanOrEqual(1024 + 1e-6);
      }
    }
  });
});
