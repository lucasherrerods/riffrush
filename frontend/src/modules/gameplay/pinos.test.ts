import { comDestaque, pinosAcesos } from "./pinos";

describe("pinosAcesos", () => {
  it("cada pino é um quarto do star power", () => {
    expect(pinosAcesos(0)).toBe(0);
    expect(pinosAcesos(0.25)).toBe(1);
    expect(pinosAcesos(0.5)).toBe(2);
    expect(pinosAcesos(0.75)).toBe(3);
    expect(pinosAcesos(1)).toBe(4);
  });

  it("o pino só acende quando o seu quarto enche", () => {
    expect(pinosAcesos(0.24)).toBe(0);
    expect(pinosAcesos(0.74)).toBe(2);
    expect(pinosAcesos(0.99)).toBe(3);
  });

  it("não passa de quatro nem fica abaixo de zero", () => {
    expect(pinosAcesos(1.4)).toBe(4);
    expect(pinosAcesos(-0.2)).toBe(0);
  });
});

describe("comDestaque", () => {
  it("os pinos brilham a partir do segundo aceso, quando o star power já pode ser usado", () => {
    expect(comDestaque(0.24)).toBe(false);
    expect(comDestaque(0.49)).toBe(false);
    expect(comDestaque(0.5)).toBe(true);
    expect(comDestaque(1)).toBe(true);
  });
});
