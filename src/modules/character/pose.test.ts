import { calcularPose } from "./pose";

const base = { tempo: 0, bpm: 120, desdeOPulso: Infinity, tocando: false, triste: false, instrumento: "guitarra" as const };

describe("calcularPose", () => {
  it("parado não palheta", () => {
    expect(calcularPose(base).palhetada).toBe(0);
  });

  it("uma nota acertada agora palheta mais do que uma antiga", () => {
    const agora = calcularPose({ ...base, tocando: true, desdeOPulso: 0.02 });
    const antiga = calcularPose({ ...base, tocando: true, desdeOPulso: 1 });
    expect(agora.palhetada).toBeGreaterThan(antiga.palhetada);
  });

  it("tocando, a cabeça balança no ritmo da música", () => {
    const umaBatida = 60 / 120;
    const inicio = calcularPose({ ...base, tocando: true, tempo: 0 }).cabeca;
    const meio = calcularPose({ ...base, tocando: true, tempo: umaBatida / 2 }).cabeca;
    const fim = calcularPose({ ...base, tocando: true, tempo: umaBatida }).cabeca;
    expect(fim).toBeCloseTo(inicio, 5);
    expect(meio).not.toBeCloseTo(inicio, 2);
  });

  it("triste abaixa a cabeça e curva o tronco", () => {
    const normal = calcularPose(base);
    const triste = calcularPose({ ...base, triste: true });
    expect(triste.cabeca).toBeGreaterThan(normal.cabeca);
    expect(triste.tronco).toBeGreaterThan(normal.tronco);
  });

  it("respira mesmo parado", () => {
    expect(calcularPose({ ...base, tempo: 0 }).respiracao).not.toBeCloseTo(calcularPose({ ...base, tempo: 1 }).respiracao, 4);
  });
});
