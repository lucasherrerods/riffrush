import { compor, ESTRUTURA } from "./composicao";
import type { EstiloMusical } from "./tipos";

const estilo: EstiloMusical = {
  bpm: 120,
  tonica: 52,
  escala: [0, 3, 5, 7, 10],
  progressao: [0, 3, 2, 1],
  timbre: "sawtooth",
  distorcao: 0.5,
  densidade: 0.5,
};
const segundosPorBatida = 0.5;

describe("compor", () => {
  it("compõe a mesma música para a mesma semente", () => {
    expect(compor(estilo, 9)).toEqual(compor(estilo, 9));
  });

  it("dura a entrada de 2 batidas mais todos os compassos da estrutura", () => {
    const totalDeCompassos = ESTRUTURA.reduce((total, [, compassos]) => total + compassos, 0);
    const { compassos, duracao } = compor(estilo, 9);
    expect(compassos).toHaveLength(totalDeCompassos);
    expect(duracao).toBeCloseTo(2 * segundosPorBatida + totalDeCompassos * 4 * segundosPorBatida + 2);
  });

  it("deixa a introdução e o final sem melodia", () => {
    const { melodia, compassos } = compor(estilo, 9);
    const fimDaIntro = compassos.find((c) => c.secao !== "intro")!.tempo;
    const inicioDoFinal = compassos.find((c) => c.secao === "final")!.tempo;
    for (const nota of melodia) {
      expect(nota.tempo).toBeGreaterThanOrEqual(fimDaIntro);
      expect(nota.tempo).toBeLessThan(inicioDoFinal);
    }
  });

  it("mantém os graus da melodia entre 0 e 9 e em ordem de tempo", () => {
    const { melodia } = compor(estilo, 9);
    for (let i = 0; i < melodia.length; i++) {
      expect(melodia[i].grau).toBeGreaterThanOrEqual(0);
      expect(melodia[i].grau).toBeLessThanOrEqual(9);
      if (i > 0) expect(melodia[i].tempo).toBeGreaterThanOrEqual(melodia[i - 1].tempo);
    }
  });

  it("cria frases de star power", () => {
    const { melodia } = compor(estilo, 9);
    expect(melodia.some((nota) => nota.frase >= 0)).toBe(true);
  });
});
