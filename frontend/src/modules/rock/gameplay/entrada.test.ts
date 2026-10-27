import { ENTRADA, emCaminho, raioDaEntrada } from "./entrada";

describe("raioDaEntrada", () => {
  it("atravessa a tela de cima a baixo, com três galhos", () => {
    const { principal, galhos } = raioDaEntrada(7);
    expect(principal[0].y).toBeLessThan(0);
    expect(principal.at(-1)!.y).toBeGreaterThan(100);
    expect(galhos).toHaveLength(3);
    for (const galho of galhos) expect(principal).toContainEqual(galho[0]);
  });

  it("a mesma semente desenha o mesmo raio", () => {
    expect(raioDaEntrada(3)).toEqual(raioDaEntrada(3));
  });

  it("vira os pontos de um polyline do SVG", () => {
    expect(emCaminho([{ x: 1, y: 2.5 }, { x: 3, y: 4 }])).toBe("1.00,2.50 3.00,4.00");
  });
});

describe("ENTRADA", () => {
  it("cada parte acontece antes do fim", () => {
    expect(Math.max(ENTRADA.clarao, ENTRADA.varrida, ENTRADA.nome, ENTRADA.saida)).toBeLessThan(ENTRADA.total);
  });
});
