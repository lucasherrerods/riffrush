import type { ConjuntoSalvo, DificuldadeSalva } from "./biblioteca";
import { TECLAS_MAXIMAS_NO_CELULAR, cabeNoCelular, soOQueCabeNoCelular, teclasDaBuscaNoCelular } from "./celular";

const mapa = (hash: string, teclas: number) => ({ hash, teclas }) as DificuldadeSalva;
const conjunto = (id: string, mapas: DificuldadeSalva[]) => ({ id, mapas }) as ConjuntoSalvo;

describe("Mania no celular", () => {
  it("só cabe até 5 teclas", () => {
    expect(TECLAS_MAXIMAS_NO_CELULAR).toBe(5);
    expect(cabeNoCelular(4)).toBe(true);
    expect(cabeNoCelular(5)).toBe(true);
    expect(cabeNoCelular(6)).toBe(false);
  });

  it("esconde as dificuldades de 6K para cima e os conjuntos que ficam sem nenhuma", () => {
    const resultado = soOQueCabeNoCelular([conjunto("a", [mapa("a4", 4), mapa("a7", 7)]), conjunto("b", [mapa("b9", 9)])]);
    expect(resultado.map((c) => c.id)).toEqual(["a"]);
    expect(resultado[0].mapas.map((m) => m.hash)).toEqual(["a4"]);
  });

  it("a busca sem tecla escolhida pede só as que cabem; com escolha, tira as que não cabem", () => {
    expect(teclasDaBuscaNoCelular([], [4, 5, 6, 7])).toEqual([4, 5]);
    expect(teclasDaBuscaNoCelular([5, 7], [4, 5, 6, 7])).toEqual([5]);
  });
});
