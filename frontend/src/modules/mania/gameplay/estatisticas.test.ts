import { comoPorcentagem, curvaDaPrecisao, histogramaDosDesvios, registrarEventos, resumoDosDesvios, type Estatisticas } from "./estatisticas";

const nova = (): Estatisticas => ({ julgamentos: [], desvios: [] });

it("guarda os julgamentos em ordem e só os desvios de toques de verdade", () => {
  const e = nova();
  // [nota, coluna, julgamento, ponta, desvio]
  registrarEventos(e, new Float64Array([0, 0, 0, 0, -4, 1, 1, 5, 0, NaN, 2, 2, 2, 0, 12]));
  expect(e.julgamentos).toEqual([0, 5, 2]);
  expect(e.desvios).toEqual([-4, 12]);
});

it("o fim da nota longa não é julgamento nem desvio", () => {
  const e = nova();
  // Cabeça com 2 ms, depois o fim da mesma nota.
  registrarEventos(e, new Float64Array([0, 0, 0, 0, 2, 0, 0, -1, 1, NaN]));
  expect(e.julgamentos).toEqual([0]);
  expect(e.desvios).toEqual([2]);
});

it("o toque cedo demais que vira Miss não entra nos desvios", () => {
  const e = nova();
  registrarEventos(e, new Float64Array([0, 0, 5, 0, -180, 1, 1, 0, 0, 3]));
  expect(e.julgamentos).toEqual([5, 0]);
  expect(e.desvios).toEqual([3]);
});

it("a curva da precisão acompanha a precisão acumulada, como o motor calcula", () => {
  // MAX, MAX, Miss, MAX: 100%, 100%, 66,7%, 75%
  expect(curvaDaPrecisao([0, 0, 5, 0], 4)).toEqual([1, 1, 2 / 3, 0.75]);
});

it("a curva tem no máximo o número de pontos pedido e sempre termina na precisão final", () => {
  const julgamentos = Array.from({ length: 1000 }, (_, i) => (i % 10 === 0 ? 3 : 0));
  const curva = curvaDaPrecisao(julgamentos, 50);
  expect(curva).toHaveLength(50);
  const final = (900 * 300 + 100 * 100) / (1000 * 300);
  expect(curva.at(-1)).toBeCloseTo(final);
});

it("sem julgamentos a curva fica vazia", () => {
  expect(curvaDaPrecisao([], 50)).toEqual([]);
});

it("resume o desvio médio e o UR (desvio padrão vezes 10)", () => {
  const { media, ur } = resumoDosDesvios([-10, 10, -10, 10]);
  expect(media).toBe(0);
  expect(ur).toBe(100);
  expect(resumoDosDesvios([])).toEqual({ media: 0, ur: 0 });
});

it("o histograma conta os desvios em faixas iguais dentro da janela e prende os de fora nas pontas", () => {
  expect(histogramaDosDesvios([-50, -20, -1, 0, 1, 20, 90], 40, 4)).toEqual([1, 2, 2, 2]);
});

it("escreve a precisão com duas casas e vírgula, no resultado e durante a partida", () => {
  expect(comoPorcentagem(0.9876)).toBe("98,76%");
  expect(comoPorcentagem(1)).toBe("100,00%");
});
