import { DURACAO_DA_MARCA_MS, MARCAS_NA_BARRA, guardarMarcas, marcasVisiveis, mediaSuavizada, posicaoNaBarra } from "./barraDeUr";

it("guarda um toque novo por desvio, com a hora em que aconteceu, e esquece os mais antigos", () => {
  const marcas = guardarMarcas([], [-5, 8], 1000);
  expect(marcas).toEqual([
    { desvio: -5, emMs: 1000 },
    { desvio: 8, emMs: 1000 },
  ]);
  const cheias = guardarMarcas(marcas, Array.from({ length: MARCAS_NA_BARRA }, () => 1), 2000);
  expect(cheias).toHaveLength(MARCAS_NA_BARRA);
  expect(cheias[0]).toEqual({ desvio: 1, emMs: 2000 });
});

it("a marca some aos poucos e sai da barra depois do tempo dela", () => {
  const marcas = [
    { desvio: 0, emMs: 1000 - DURACAO_DA_MARCA_MS },
    { desvio: 3, emMs: 900 },
  ];
  const visiveis = marcasVisiveis(marcas, 1000);
  expect(visiveis).toEqual([{ desvio: 3, alfa: 1 - 100 / DURACAO_DA_MARCA_MS }]);
  expect(marcasVisiveis(marcas, 900 + DURACAO_DA_MARCA_MS)).toEqual([]);
});

it("a posição vai de 0 (cedo no limite) a 1 (tarde no limite), presa nas pontas", () => {
  expect(posicaoNaBarra(0, 100)).toBe(0.5);
  expect(posicaoNaBarra(-100, 100)).toBe(0);
  expect(posicaoNaBarra(50, 100)).toBe(0.75);
  expect(posicaoNaBarra(300, 100)).toBe(1);
});

it("a média da seta começa no primeiro toque e anda devagar com os seguintes", () => {
  expect(mediaSuavizada(undefined, [])).toBeUndefined();
  expect(mediaSuavizada(undefined, [-10])).toBe(-10);
  const depois = mediaSuavizada(-10, [10])!;
  expect(depois).toBeGreaterThan(-10);
  expect(depois).toBeLessThan(0);
  // Sem toque novo ela fica parada: as marcas que somem não mexem na seta.
  expect(mediaSuavizada(depois, [])).toBe(depois);
});
