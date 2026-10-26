import { estiloDoJulgamento, forcaDoTrovao, pontosDoRaio, progressoDoMultiplicador, tremor } from "./efeitos";

describe("forcaDoTrovao", () => {
  it("não troveja fora dos marcos de combo", () => {
    for (const sequencia of [0, 1, 24, 26, 49, 51, 99]) expect(forcaDoTrovao(sequencia)).toBe(0);
  });

  it("troveja mais forte conforme o combo cresce", () => {
    expect(forcaDoTrovao(25)).toBe(1);
    expect(forcaDoTrovao(50)).toBe(2);
    expect(forcaDoTrovao(100)).toBe(3);
    expect(forcaDoTrovao(150)).toBe(3);
    expect(forcaDoTrovao(125)).toBe(0);
  });
});

describe("pontosDoRaio", () => {
  it("liga o ponto de partida ao de chegada em zigue-zague", () => {
    const pontos = pontosDoRaio(7, { x: 0, y: 0 }, { x: 0, y: 100 }, 8, 20);
    expect(pontos[0]).toEqual({ x: 0, y: 0 });
    expect(pontos.at(-1)).toEqual({ x: 0, y: 100 });
    expect(pontos).toHaveLength(9);
    expect(pontos.some((p) => Math.abs(p.x) > 1)).toBe(true);
    for (const p of pontos) expect(Math.abs(p.x)).toBeLessThanOrEqual(20);
  });

  it("a mesma semente desenha o mesmo raio, para ele não piscar de forma a cada quadro", () => {
    expect(pontosDoRaio(3, { x: 0, y: 0 }, { x: 10, y: 90 }, 6, 15)).toEqual(pontosDoRaio(3, { x: 0, y: 0 }, { x: 10, y: 90 }, 6, 15));
    expect(pontosDoRaio(3, { x: 0, y: 0 }, { x: 10, y: 90 }, 6, 15)).not.toEqual(pontosDoRaio(4, { x: 0, y: 0 }, { x: 10, y: 90 }, 6, 15));
  });
});

describe("tremor", () => {
  it("sacode forte logo ao soltar o especial e para depois", () => {
    const inicio = tremor(0.05);
    const fim = tremor(2);
    expect(Math.hypot(inicio.x, inicio.y)).toBeGreaterThan(2);
    expect(fim).toEqual({ x: 0, y: 0, angulo: 0 });
  });

  it("vai perdendo força", () => {
    const forca = (t: number) => Math.max(...Array.from({ length: 20 }, (_, i) => Math.hypot(tremor(t + i * 0.003).x, tremor(t + i * 0.003).y)));
    expect(forca(0.05)).toBeGreaterThan(forca(0.5));
  });
});

describe("progressoDoMultiplicador", () => {
  it("enche a cada 10 notas até o multiplicador máximo", () => {
    expect(progressoDoMultiplicador(0)).toBe(0);
    expect(progressoDoMultiplicador(5)).toBeCloseTo(0.5);
    expect(progressoDoMultiplicador(10)).toBe(0);
    expect(progressoDoMultiplicador(29)).toBeCloseTo(0.9);
    expect(progressoDoMultiplicador(30)).toBe(1);
    expect(progressoDoMultiplicador(500)).toBe(1);
  });
});

describe("estiloDoJulgamento", () => {
  it("cada julgamento tem o seu texto e uma cor diferente", () => {
    const estilos = (["perfeito", "otimo", "bom"] as const).map(estiloDoJulgamento);
    expect(estilos.map((e) => e.texto)).toEqual(["PERFEITO", "ÓTIMO", "BOM"]);
    expect(new Set(estilos.map((e) => e.cor)).size).toBe(3);
  });
});
