import { batidasDaCalibracao, medirAtraso } from "./calibracao";

const batidas = batidasDaCalibracao(10, 16, 0.5);
const toquesCom = (atraso: number) => batidas.map((b) => b + atraso);

describe("batidasDaCalibracao", () => {
  it("gera as batidas do metrônomo no intervalo pedido", () => {
    expect(batidas).toHaveLength(16);
    expect(batidas[1] - batidas[0]).toBeCloseTo(0.5);
    expect(batidas[0]).toBe(10);
  });
});

describe("medirAtraso", () => {
  it("mede o atraso dos toques em milissegundos", () => {
    expect(medirAtraso(batidas, toquesCom(0.03))).toBe(30);
  });

  it("funciona para toques adiantados", () => {
    expect(medirAtraso(batidas, toquesCom(-0.02))).toBe(-20);
  });

  it("usa a mediana: um toque muito fora não estraga a medida", () => {
    const toques = toquesCom(0.03);
    toques[8] += 0.2;
    expect(medirAtraso(batidas, toques)).toBe(30);
  });

  it("ignora as primeiras batidas, que são de aquecimento", () => {
    const toques = toquesCom(0.03).map((t, i) => (i < 4 ? t + 0.1 : t));
    expect(medirAtraso(batidas, toques)).toBe(30);
  });

  it("ignora toques longe de qualquer batida", () => {
    expect(medirAtraso(batidas, [...toquesCom(0.03), batidas[10] + 0.25])).toBe(30);
  });

  it("arredonda para múltiplos de 5 ms", () => {
    expect(medirAtraso(batidas, toquesCom(0.032))).toBe(30);
  });

  it("limita a ±200 ms", () => {
    expect(medirAtraso(batidas, toquesCom(0.24))).toBe(200);
  });

  it("perto da metade do intervalo, toques que caem dos dois lados da fronteira contam como o mesmo atraso", () => {
    // Variação humana em volta de -230 ms: parte dos toques fica mais perto da batida anterior.
    const variacao = [0, 0.03, -0.03, 0.04, 0.03, -0.02, 0.035, 0.03, -0.01, 0.04, 0.03, 0.025, 0.03, 0.04, -0.02, 0.03];
    const toques = batidas.map((b, i) => b - 0.23 + variacao[i]);
    expect(medirAtraso(batidas, toques)).toBe(-200);
  });

  it("na fronteira, o lado vem do centro dos toques, e não de quantos passaram para o outro lado", () => {
    // Centro em -245 ms: os toques de -265 ms ficam mais perto da batida anterior (+235 ms).
    const variacao = [0, 0.02, -0.02, -0.02, -0.02, 0.02, -0.02, -0.02, 0.02, -0.02, -0.02, 0.03, -0.02, -0.02, 0.02, -0.01];
    const toques = batidas.map((b, i) => b - 0.24 + variacao[i]);
    expect(medirAtraso(batidas, toques)).toBe(-200);
  });

  it("o mesmo vale para atrasos positivos perto da fronteira", () => {
    const variacao = [0, -0.03, 0.03, -0.04, -0.03, 0.02, -0.035, -0.03, 0.01, -0.04, -0.03, -0.025, -0.03, -0.04, 0.02, -0.03];
    const toques = batidas.map((b, i) => b + 0.23 + variacao[i]);
    expect(medirAtraso(batidas, toques)).toBe(200);
  });

  it("não mede com menos de 4 toques válidos", () => {
    expect(medirAtraso(batidas, toquesCom(0.03).slice(4, 7))).toBeNull();
  });
});
