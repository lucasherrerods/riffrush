import { posicoesPorPontos } from "./posicoes";

describe("posicoesPorPontos", () => {
  it("dá a posição de cada um na ordem recebida; empatados dividem a posição", () => {
    expect(posicoesPorPontos([100, 300, 200])).toEqual([3, 1, 2]);
    expect(posicoesPorPontos([50, 50, 10])).toEqual([1, 1, 3]);
  });
});
