import { pesosDasExpressoes } from "./aparencia";

describe("pesosDasExpressoes", () => {
  const base = { triste: false, tempo: 0.5, desdeOPulso: Infinity };

  it("fica com um sorriso relaxado", () => {
    expect(pesosDasExpressoes(base).relaxed).toBeGreaterThan(0);
  });

  it("triste vence a expressão de base", () => {
    const pesos = pesosDasExpressoes({ ...base, triste: true });
    expect(pesos.sad).toBeGreaterThan(0.5);
    expect(pesos.relaxed ?? 0).toBe(0);
  });

  it("sorri por um instante ao acertar uma nota", () => {
    expect(pesosDasExpressoes({ ...base, desdeOPulso: 0.05 }).happy).toBeGreaterThan(pesosDasExpressoes({ ...base, desdeOPulso: 2 }).happy ?? 0);
  });

  it("pisca de tempos em tempos", () => {
    const piscadas = Array.from({ length: 400 }, (_, i) => pesosDasExpressoes({ ...base, tempo: i * 0.025 }).blink ?? 0);
    expect(Math.max(...piscadas)).toBeGreaterThan(0.9);
    expect(piscadas.filter((p) => p > 0.5).length).toBeLessThan(piscadas.length / 4);
  });
});
