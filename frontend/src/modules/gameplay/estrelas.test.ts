import { FAIXAS_DAS_ESTRELAS, estrelasPorPontos, progressoDasEstrelas } from "./estrelas";

/** 100 notas valem 5.000 pontos de base (50 por nota, sem multiplicador). */
const NOTAS = 100;
const base = (vezes: number) => vezes * NOTAS * 50;

describe("progressoDasEstrelas", () => {
  it("começa vazia", () => {
    expect(progressoDasEstrelas(0, NOTAS)).toBe(0);
  });

  it.each(FAIXAS_DAS_ESTRELAS.map((vezes, i) => [i + 1, vezes]))("a estrela %i acende com %f vezes a pontuação base", (estrela, vezes) => {
    expect(progressoDasEstrelas(base(vezes), NOTAS)).toBeCloseTo(estrela);
    expect(estrelasPorPontos(base(vezes), NOTAS)).toBe(estrela);
    expect(estrelasPorPontos(base(vezes) - 1, NOTAS)).toBe(estrela - 1);
  });

  it("enche aos poucos entre uma estrela e a próxima", () => {
    const meio = (FAIXAS_DAS_ESTRELAS[2] + FAIXAS_DAS_ESTRELAS[3]) / 2;
    expect(progressoDasEstrelas(base(meio), NOTAS)).toBeCloseTo(3.5);
  });

  it("não passa de 5 estrelas", () => {
    expect(progressoDasEstrelas(base(10), NOTAS)).toBe(5);
  });

  it("música sem notas não dá estrelas", () => {
    expect(progressoDasEstrelas(1000, 0)).toBe(0);
  });
});
