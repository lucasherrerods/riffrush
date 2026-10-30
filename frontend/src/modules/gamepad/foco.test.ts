import { maisProximoNaDirecao } from "./foco";

const caixa = (x: number, y: number, largura = 10, altura = 10) => ({ left: x, top: y, right: x + largura, bottom: y + altura });

describe("maisProximoNaDirecao", () => {
  // Três botões numa linha e um embaixo do primeiro.
  const caixas = [caixa(0, 0), caixa(20, 0), caixa(40, 0), caixa(0, 20)];

  it("vai para o vizinho do lado pedido", () => {
    expect(maisProximoNaDirecao(caixas[0], caixas, "direita")).toBe(1);
    expect(maisProximoNaDirecao(caixas[1], caixas, "esquerda")).toBe(0);
    expect(maisProximoNaDirecao(caixas[0], caixas, "baixo")).toBe(3);
  });

  it("prefere o alinhado ao que está mais perto na diagonal", () => {
    const comDiagonal = [caixa(0, 0), caixa(15, 12), caixa(0, 30)];
    expect(maisProximoNaDirecao(comDiagonal[0], comDiagonal, "baixo")).toBe(2);
  });

  it("não sai do lugar quando não há nada naquela direção", () => {
    expect(maisProximoNaDirecao(caixas[0], caixas, "cima")).toBe(-1);
    expect(maisProximoNaDirecao(caixas[2], caixas, "direita")).toBe(-1);
  });

  it("sem nada em foco, começa pelo primeiro", () => {
    expect(maisProximoNaDirecao(null, caixas, "baixo")).toBe(0);
    expect(maisProximoNaDirecao(null, [], "baixo")).toBe(-1);
  });
});
