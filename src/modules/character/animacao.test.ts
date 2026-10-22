import { POSE_DE_DESCANSO, ajustesDaPose, animacaoDoInstrumento } from "./animacao";

describe("animacaoDoInstrumento", () => {
  it("usa as animações compartilhadas do instrumento", () => {
    expect(animacaoDoInstrumento("guitarra", 0)).toBe("guitarra-1");
    expect(animacaoDoInstrumento("keytar", 0)).toBe("teclado-1");
  });

  it("varia entre as animações do instrumento pela semente", () => {
    expect(animacaoDoInstrumento("guitarra", 1)).toBe("guitarra-2");
    expect(animacaoDoInstrumento("guitarra", 2)).toBe("guitarra-1");
  });

  it("sem animação baixada para o instrumento, fica no idle procedural", () => {
    expect(animacaoDoInstrumento("bateria", 0)).toBeNull();
  });
});

describe("POSE_DE_DESCANSO", () => {
  it("baixa os braços da pose em T para os lados do corpo", () => {
    expect(POSE_DE_DESCANSO.leftUpperArm[2]).toBeLessThan(-1);
    expect(POSE_DE_DESCANSO.rightUpperArm[2]).toBeGreaterThan(1);
  });
});

describe("ajustesDaPose", () => {
  const base = { tempo: 0, bpm: 120, tocando: false, triste: false, comAnimacao: false };

  it("respira mesmo parado", () => {
    expect(ajustesDaPose({ ...base, tempo: 0 }).chest[0]).not.toBeCloseTo(ajustesDaPose({ ...base, tempo: 1 }).chest[0], 4);
  });

  it("tocando sem animação de instrumento, balança a cabeça no ritmo", () => {
    const meio = (60 / 120) / 2;
    expect(ajustesDaPose({ ...base, tocando: true, tempo: meio }).head[0]).toBeGreaterThan(ajustesDaPose({ ...base, tocando: true }).head[0] + 0.05);
  });

  it("com animação de instrumento não soma outro balanço de cabeça", () => {
    const meio = (60 / 120) / 2;
    expect(ajustesDaPose({ ...base, tocando: true, comAnimacao: true, tempo: meio }).head[0]).toBeCloseTo(0);
  });

  it("triste abaixa a cabeça e curva os ombros", () => {
    expect(ajustesDaPose({ ...base, triste: true }).head[0]).toBeGreaterThan(ajustesDaPose(base).head[0]);
    expect(ajustesDaPose({ ...base, triste: true }).spine[0]).toBeGreaterThan(ajustesDaPose(base).spine[0]);
  });
});
