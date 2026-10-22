import { adicionarSustains, chartDaMelodia } from "./chart";
import type { NotaDaMelodia } from "./composicao";
import type { Nota } from "./tipos";

const nota = (tempo: number, pista = 0): Nota => ({ tempo, pista, frase: -1, duracao: 0 });
const melodica = (tempo: number, passo: number, grau: number, extra: Partial<NotaDaMelodia> = {}): NotaDaMelodia => ({
  tempo,
  passo,
  grau,
  acorde: false,
  frase: -1,
  ...extra,
});

describe("adicionarSustains", () => {
  it("segura a nota até um pouco antes da próxima quando há espaço", () => {
    const [primeira] = adicionarSustains([nota(0), nota(1)], 0.5, 0.2);
    expect(primeira.duracao).toBeCloseTo(0.8);
  });

  it("não cria sustain quando a próxima nota está perto", () => {
    const [primeira] = adicionarSustains([nota(0), nota(0.3)], 0.5, 0.2);
    expect(primeira.duracao).toBe(0);
  });

  it("dá o mesmo sustain para as notas de um acorde", () => {
    const [a, b] = adicionarSustains([nota(0, 0), nota(0, 2), nota(1)], 0.5, 0.2);
    expect(a.duracao).toBeCloseTo(0.8);
    expect(b.duracao).toBeCloseTo(0.8);
  });
});

describe("chartDaMelodia", () => {
  const melodia = [
    melodica(0, 0, 9, { acorde: true }),
    melodica(0.125, 1, 5),
    melodica(0.25, 2, 3),
    melodica(0.5, 4, 0, { frase: 1 }),
  ];

  it("no fácil usa só as notas da batida e 3 pistas", () => {
    const notas = chartDaMelodia(melodia, "facil", 0.5);
    expect(notas.map((n) => n.tempo)).toEqual([0, 0.5]);
    expect(Math.max(...notas.map((n) => n.pista))).toBeLessThan(3);
  });

  it("no difícil ignora as semicolcheias quebradas e usa 5 pistas", () => {
    const tempos = chartDaMelodia(melodia, "dificil", 0.5).map((n) => n.tempo);
    expect(tempos).not.toContain(0.125);
    expect(tempos).toContain(0.25);
  });

  it("no expert mantém todas as notas", () => {
    const tempos = new Set(chartDaMelodia(melodia, "expert", 0.5).map((n) => n.tempo));
    expect(tempos.size).toBe(melodia.length);
  });

  it("acordes viram duas notas separadas por duas pistas, só no difícil e no expert", () => {
    const acorde = chartDaMelodia(melodia, "expert", 0.5).filter((n) => n.tempo === 0);
    expect(acorde).toHaveLength(2);
    expect(Math.abs(acorde[0].pista - acorde[1].pista)).toBe(2);
    expect(chartDaMelodia(melodia, "medio", 0.5).filter((n) => n.tempo === 0)).toHaveLength(1);
  });

  it("mantém a frase de star power", () => {
    expect(chartDaMelodia(melodia, "expert", 0.5).find((n) => n.tempo === 0.5)?.frase).toBe(1);
  });
});
