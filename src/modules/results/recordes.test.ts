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
  it.each([
    [100, 5],
    [98, 5],
    [90, 4],
    [75, 3],
    [50, 2],
    [10, 1],
  ])("%i%% de acerto dá %i estrelas", (acertos, estrelas) => {
    expect(estrelasDoResultado(resultado({ acertos }))).toBe(estrelas);
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
    expect(recordeDe(carregarRecordes(), "neon", "medio")).toEqual({ pontos: 1000, estrelas: 4, fullCombo: false });
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
