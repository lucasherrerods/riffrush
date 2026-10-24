import { criarCacheLimitado } from "./cacheLimitado";

describe("criarCacheLimitado", () => {
  it("guarda e devolve os valores", () => {
    const cache = criarCacheLimitado<number>(2);
    cache.guardar("a", 1);
    expect(cache.ler("a")).toBe(1);
    expect(cache.ler("b")).toBeUndefined();
  });

  it("passando do limite, descarta o usado há mais tempo", () => {
    const cache = criarCacheLimitado<number>(2);
    cache.guardar("a", 1);
    cache.guardar("b", 2);
    cache.ler("a");
    cache.guardar("c", 3);
    expect(cache.ler("b")).toBeUndefined();
    expect(cache.ler("a")).toBe(1);
    expect(cache.ler("c")).toBe(3);
  });

  it("apaga um valor", () => {
    const cache = criarCacheLimitado<number>(2);
    cache.guardar("a", 1);
    cache.apagar("a");
    expect(cache.ler("a")).toBeUndefined();
  });
});
