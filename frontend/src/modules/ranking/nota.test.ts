import { notaDaPrecisao } from "./nota";

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
