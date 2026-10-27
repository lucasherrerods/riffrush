import { pinosAcesos } from "./pinos";

describe("pinosAcesos", () => {
  it("cada pino é uma terça parte do star power", () => {
    expect(pinosAcesos(0)).toBe(0);
    expect(pinosAcesos(1 / 3)).toBe(1);
    expect(pinosAcesos(2 / 3)).toBe(2);
    expect(pinosAcesos(1)).toBe(3);
  });

  it("o pino só acende quando a sua terça parte enche", () => {
    expect(pinosAcesos(0.33)).toBe(0);
    expect(pinosAcesos(0.66)).toBe(1);
    expect(pinosAcesos(0.99)).toBe(2);
  });

  it("não passa de três nem fica abaixo de zero", () => {
    expect(pinosAcesos(1.4)).toBe(3);
    expect(pinosAcesos(-0.2)).toBe(0);
  });
});
