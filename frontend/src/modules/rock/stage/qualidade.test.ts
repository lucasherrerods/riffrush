import { QUALIDADES_DO_PALCO, ajustesDoPalco, escalaDoCanvas, limitarEscalaDeRenderizacao } from "./qualidade";

describe("ajustesDoPalco", () => {
  it("a média é o palco de sempre: 60% da resolução a 30 quadros por segundo", () => {
    expect(ajustesDoPalco("media")).toEqual({ resolucao: 0.6, quadrosPorSegundo: 30 });
  });

  it("quanto mais alta a qualidade, mais resolução e mais quadros", () => {
    const [leve, media, alta] = (["leve", "media", "alta"] as const).map(ajustesDoPalco);
    expect(leve.resolucao).toBeLessThan(media.resolucao);
    expect(alta.resolucao).toBeGreaterThan(media.resolucao);
    expect(leve.quadrosPorSegundo).toBeLessThan(media.quadrosPorSegundo);
    expect(alta.quadrosPorSegundo).toBeGreaterThan(media.quadrosPorSegundo);
  });

  it("lista as qualidades com rótulos para as configurações", () => {
    expect(QUALIDADES_DO_PALCO.map((q) => q.rotulo)).toEqual(["Leve", "Média", "Alta"]);
  });
});

describe("escala de renderização da pista", () => {
  it("fica entre 50% e 100%", () => {
    expect(limitarEscalaDeRenderizacao(0.2)).toBe(0.5);
    expect(limitarEscalaDeRenderizacao(1.4)).toBe(1);
    expect(limitarEscalaDeRenderizacao(0.75)).toBe(0.75);
    expect(limitarEscalaDeRenderizacao(Number.NaN)).toBe(1);
  });

  it("multiplica a densidade da tela, que continua limitada a 2", () => {
    expect(escalaDoCanvas(1, 1)).toBe(1);
    expect(escalaDoCanvas(3, 1)).toBe(2);
    expect(escalaDoCanvas(2, 0.5)).toBe(1);
    expect(escalaDoCanvas(0, 0.5)).toBe(0.5);
  });
});
