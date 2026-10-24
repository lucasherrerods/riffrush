import type { Resultado } from "@/modules/gameplay";
import { carregarRecordes, estrelasDoResultado, recordeDe, salvarRecorde } from "./recordes";

const resultado = (extra: Partial<Resultado> = {}): Resultado => ({
  musicaId: "neon",
  dificuldade: "medio",
  pontos: 1000,
  acertos: 90,
  total: 100,
  maiorSequencia: 40,
  derrota: false,
  ...extra,
});

beforeEach(() => localStorage.clear());

describe("estrelasDoResultado", () => {
  // A barra da partida e o resultado usam a mesma escala: pontos em relação à base da música (50 por nota).
  it.each([
    [14_000, 5],
    [10_000, 4],
    [5_000, 3],
    [2_500, 2],
    [1_250, 1],
  ])("%i pontos em 100 notas dão %i estrelas", (pontos, estrelas) => {
    expect(estrelasDoResultado(resultado({ pontos, total: 100 }))).toBe(estrelas);
  });

  it("terminar a música sem derrota dá pelo menos 1 estrela", () => {
    expect(estrelasDoResultado(resultado({ pontos: 10, total: 100 }))).toBe(1);
  });

  it("derrota não dá estrelas", () => {
    expect(estrelasDoResultado(resultado({ derrota: true }))).toBe(0);
  });

  it("música sem notas não dá estrelas", () => {
    expect(estrelasDoResultado(resultado({ total: 0, acertos: 0 }))).toBe(0);
  });
});

describe("salvarRecorde", () => {
  it("salva o primeiro resultado como recorde", () => {
    expect(salvarRecorde(resultado())).toBe(true);
    expect(recordeDe(carregarRecordes(), "neon", "medio")).toEqual({ pontos: 1000, estrelas: estrelasDoResultado(resultado()), fullCombo: false });
  });

  it("só substitui quando os pontos são maiores", () => {
    salvarRecorde(resultado({ pontos: 1000 }));
    expect(salvarRecorde(resultado({ pontos: 900 }))).toBe(false);
    expect(salvarRecorde(resultado({ pontos: 1100 }))).toBe(true);
    expect(recordeDe(carregarRecordes(), "neon", "medio")?.pontos).toBe(1100);
  });

  it("guarda um recorde para cada dificuldade", () => {
    salvarRecorde(resultado({ dificuldade: "facil", pontos: 10 }));
    expect(recordeDe(carregarRecordes(), "neon", "medio")).toBeUndefined();
  });

  it("não salva partida em que virou fantasma no multijogador: a vida zerou no meio", () => {
    expect(salvarRecorde(resultado({ fantasma: true }))).toBe(false);
  });

  it("não salva derrotas", () => {
    expect(salvarRecorde(resultado({ derrota: true }))).toBe(false);
  });

  it("marca full combo quando acertou todas as notas", () => {
    salvarRecorde(resultado({ acertos: 100 }));
    expect(recordeDe(carregarRecordes(), "neon", "medio")?.fullCombo).toBe(true);
  });

  it("ignora recordes corrompidos", () => {
    localStorage.setItem("riffrush.recordes", "{quebrado");
    expect(carregarRecordes()).toEqual({});
  });
});
