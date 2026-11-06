import { criarCanvasFalso } from "@/test/canvasFalso";
import { tracarForma } from "./formas";

const metodos = (formato: Parameters<typeof tracarForma>[1]) => {
  const { contexto, chamadas } = criarCanvasFalso();
  tracarForma(contexto, formato, 50, 50, 20, 10);
  return chamadas.map((c) => c.metodo);
};

describe("tracarForma", () => {
  it("redonda é uma elipse", () => {
    expect(metodos("redonda")).toEqual(["beginPath", "ellipse"]);
  });

  it("retangular é um retângulo de cantos arredondados", () => {
    expect(metodos("retangular")).toEqual(["beginPath", "roundRect"]);
  });

  it("hexagonal tem seis pontas", () => {
    const m = metodos("hexagonal");
    expect(m.filter((x) => x === "moveTo").length + m.filter((x) => x === "lineTo").length).toBe(6);
    expect(m.at(-1)).toBe("closePath");
  });

  it("o hexágono cabe na caixa da elipse", () => {
    const { contexto, chamadas } = criarCanvasFalso();
    tracarForma(contexto, "hexagonal", 50, 50, 20, 10);
    for (const { args } of chamadas.filter((c) => c.metodo === "moveTo" || c.metodo === "lineTo")) {
      expect(Math.abs((args[0] as number) - 50)).toBeLessThanOrEqual(20);
      expect(Math.abs((args[1] as number) - 50)).toBeLessThanOrEqual(10);
    }
  });
});
