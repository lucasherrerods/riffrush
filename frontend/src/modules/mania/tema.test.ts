import { CORES_DA_PISTA, coresDasColunas } from "./tema";

const { notaDaBorda: B, notaDoMeio: M, notaDoCentro: C } = CORES_DA_PISTA;

it("as cores das colunas são simétricas, com o centro dos mapas ímpares destacado", () => {
  expect(coresDasColunas(1)).toEqual([B]);
  expect(coresDasColunas(4)).toEqual([B, M, M, B]);
  expect(coresDasColunas(7)).toEqual([B, M, B, C, B, M, B]);
  for (let k = 1; k <= 18; k++) {
    const colunas = coresDasColunas(k);
    expect(colunas).toEqual([...colunas].reverse());
  }
});
