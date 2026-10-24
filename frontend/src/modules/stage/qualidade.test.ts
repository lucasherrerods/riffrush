import { QUALIDADES_DO_PALCO, ajustesDoPalco } from "./qualidade";

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
