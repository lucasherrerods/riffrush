import type { Resultado } from "@/modules/gameplay";
import { anotarRecorde, definirRecordes, estrelasDoResultado, recordeDe, recordesAtuais, recordesDaApi } from "./recordes";

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

beforeEach(() => definirRecordes([]));

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

describe("anotarRecorde", () => {
  it("anota o primeiro resultado como recorde", () => {
    expect(anotarRecorde(resultado())).toBe(true);
    expect(recordeDe(recordesAtuais(), "neon", "medio")).toEqual({ pontos: 1000, estrelas: 1, fullCombo: false });
  });

  it("só substitui quando os pontos são maiores", () => {
    anotarRecorde(resultado({ pontos: 1000 }));
    expect(anotarRecorde(resultado({ pontos: 900 }))).toBe(false);
    expect(anotarRecorde(resultado({ pontos: 1100 }))).toBe(true);
    expect(recordeDe(recordesAtuais(), "neon", "medio")?.pontos).toBe(1100);
  });

  it("não anota derrotas nem partida de fantasma", () => {
    expect(anotarRecorde(resultado({ derrota: true }))).toBe(false);
    expect(anotarRecorde(resultado({ fantasma: true }))).toBe(false);
    expect(recordesAtuais()).toEqual({});
  });

  it("marca full combo quando acertou todas as notas", () => {
    anotarRecorde(resultado({ acertos: 100, total: 100 }));
    expect(recordeDe(recordesAtuais(), "neon", "medio")?.fullCombo).toBe(true);
  });

  it("cada instrumento tem o próprio recorde", () => {
    anotarRecorde(resultado({ pontos: 500 }));
    anotarRecorde(resultado({ pontos: 800, instrumento: "baixo" }));
    expect(recordeDe(recordesAtuais(), "neon", "medio")?.pontos).toBe(500);
    expect(recordeDe(recordesAtuais(), "neon", "medio", "baixo")?.pontos).toBe(800);
  });
});

describe("recordesDaApi", () => {
  it("monta os recordes com estrelas e full combo a partir das partidas da API", () => {
    const recordes = recordesDaApi([
      { musica_id: "encore:abc", dificuldade: "expert", instrumento: "guitarra", pontos: 10_000, acertos: 100, total: 100 },
      { musica_id: "encore:abc", dificuldade: "expert", instrumento: "baixo", pontos: 2_500, acertos: 80, total: 100 },
    ]);
    expect(recordeDe(recordes, "encore:abc", "expert")).toEqual({ pontos: 10_000, estrelas: 4, fullCombo: true });
    expect(recordeDe(recordes, "encore:abc", "expert", "baixo")).toEqual({ pontos: 2_500, estrelas: 2, fullCombo: false });
  });

  it("trocar de conta troca os recordes", () => {
    definirRecordes([{ musica_id: "a", dificuldade: "facil", instrumento: "guitarra", pontos: 1, acertos: 1, total: 1 }]);
    definirRecordes([]);
    expect(recordesAtuais()).toEqual({});
  });
});
