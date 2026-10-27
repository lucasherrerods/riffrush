import { estiloDaNota, notaDaPrecisao, type Nota } from "./nota";

describe("notaDaPrecisao", () => {
  it("segue as faixas do osu!mania", () => {
    expect(notaDaPrecisao(1)).toBe("SS");
    expect(notaDaPrecisao(0.9999)).toBe("S");
    expect(notaDaPrecisao(0.9501)).toBe("S");
    expect(notaDaPrecisao(0.95)).toBe("A");
    expect(notaDaPrecisao(0.9001)).toBe("A");
    expect(notaDaPrecisao(0.85)).toBe("B");
    expect(notaDaPrecisao(0.75)).toBe("C");
    expect(notaDaPrecisao(0.7)).toBe("D");
    expect(notaDaPrecisao(0)).toBe("D");
  });

  it("os 100% que chegam com erro de arredondamento ainda são SS", () => {
    expect(notaDaPrecisao(0.1 + 0.2 + 0.7)).toBe("SS");
    expect(notaDaPrecisao(1 - 1e-12)).toBe("SS");
  });
});

describe("estiloDaNota", () => {
  const ordem: Nota[] = ["D", "C", "B", "A", "S", "SS"];

  it("cada nota chama mais atenção que a de baixo", () => {
    const estilos = ordem.map(estiloDaNota);
    for (let i = 1; i < estilos.length; i++) {
      expect(estilos[i].intensidade).toBeGreaterThan(estilos[i - 1].intensidade);
      expect(estilos[i].escala).toBeGreaterThanOrEqual(estilos[i - 1].escala);
    }
  });

  it("só as notas altas ganham aro e brilho", () => {
    expect(estiloDaNota("D")).toMatchObject({ aro: false, brilho: false });
    expect(estiloDaNota("B")).toMatchObject({ aro: true, brilho: false });
    expect(estiloDaNota("S")).toMatchObject({ aro: true, brilho: true });
    expect(estiloDaNota("SS")).toMatchObject({ aro: true, brilho: true });
  });
});
