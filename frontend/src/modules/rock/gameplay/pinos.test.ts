import { especialUtilizavel, nivelDoLiquido, pinosPulsando, progressoDosPinos } from "./pinos";

describe("progressoDosPinos", () => {
  it("cada pino é um quarto do star power e enche da esquerda para a direita", () => {
    expect(progressoDosPinos(0)).toEqual([0, 0, 0, 0]);
    expect(progressoDosPinos(0.25)).toEqual([1, 0, 0, 0]);
    expect(progressoDosPinos(0.5)).toEqual([1, 1, 0, 0]);
    expect(progressoDosPinos(0.75)).toEqual([1, 1, 1, 0]);
    expect(progressoDosPinos(1)).toEqual([1, 1, 1, 1]);
  });

  it("o pino que está enchendo fica no meio do caminho", () => {
    expect(progressoDosPinos(0.375)).toEqual([1, 0.5, 0, 0]);
  });

  it("não passa de cheio nem de vazio", () => {
    expect(progressoDosPinos(1.4)).toEqual([1, 1, 1, 1]);
    expect(progressoDosPinos(-0.2)).toEqual([0, 0, 0, 0]);
  });
});

describe("nivelDoLiquido", () => {
  // Um vidro inclinado: topo esquerdo, topo direito, base direita, base esquerda.
  const vidro = [
    { x: 10, y: 0 },
    { x: 30, y: 0 },
    { x: 40, y: 40 },
    { x: 20, y: 40 },
  ] as const;

  it("vazio, o líquido é só a linha da base", () => {
    expect(nivelDoLiquido(vidro, 0)).toBe("20,40 40,40 40,40 20,40");
  });

  it("sobe da base pelas laterais do vidro, seguindo a inclinação", () => {
    expect(nivelDoLiquido(vidro, 0.5)).toBe("15,20 35,20 40,40 20,40");
  });

  it("cheio, ocupa o vidro inteiro e não passa dele", () => {
    expect(nivelDoLiquido(vidro, 1)).toBe("10,0 30,0 40,40 20,40");
    expect(nivelDoLiquido(vidro, 1.5)).toBe("10,0 30,0 40,40 20,40");
  });
});

describe("pinosPulsando", () => {
  it("pulsa a partir do segundo pino cheio", () => {
    expect(pinosPulsando([1, 0.9, 0, 0])).toBe(false);
    expect(pinosPulsando([1, 1, 0, 0])).toBe(true);
    expect(pinosPulsando([1, 1, 1, 1])).toBe(true);
  });
});

describe("especialUtilizavel", () => {
  it("só a partir do segundo pino cheio", () => {
    expect(especialUtilizavel(0.49, false)).toBe(false);
    expect(especialUtilizavel(0.5, false)).toBe(true);
    expect(especialUtilizavel(1, false)).toBe(true);
  });

  it("não com o especial já ativo", () => {
    expect(especialUtilizavel(1, true)).toBe(false);
  });
});
