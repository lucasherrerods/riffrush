import { geradorAleatorio } from "./aleatorio";

describe("geradorAleatorio", () => {
  it("repete a mesma sequência para a mesma semente", () => {
    const a = geradorAleatorio(42);
    const b = geradorAleatorio(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("gera sequências diferentes para sementes diferentes", () => {
    expect(geradorAleatorio(1)()).not.toBe(geradorAleatorio(2)());
  });

  it("gera números entre 0 e 1", () => {
    const aleatorio = geradorAleatorio(7);
    for (let i = 0; i < 1000; i++) {
      const n = aleatorio();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
