import { ehArrasteParaCima } from "./gesto";

describe("ehArrasteParaCima", () => {
  it("arrastar o dedo para cima o bastante solta o star power", () => {
    expect(ehArrasteParaCima({ x: 100, y: 600 }, { x: 110, y: 500 })).toBe(true);
  });

  it("toque parado, curto ou para baixo não conta", () => {
    expect(ehArrasteParaCima({ x: 100, y: 600 }, { x: 100, y: 600 })).toBe(false);
    expect(ehArrasteParaCima({ x: 100, y: 600 }, { x: 100, y: 570 })).toBe(false);
    expect(ehArrasteParaCima({ x: 100, y: 500 }, { x: 100, y: 600 })).toBe(false);
  });

  it("arraste mais de lado do que para cima não conta", () => {
    expect(ehArrasteParaCima({ x: 100, y: 600 }, { x: 300, y: 520 })).toBe(false);
  });
});
