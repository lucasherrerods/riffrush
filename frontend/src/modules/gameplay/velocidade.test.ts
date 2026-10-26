import { noTempoReal, rotuloDaVelocidade } from "./velocidade";

describe("velocidade da música", () => {
  it("escreve a velocidade como o jogador lê", () => {
    expect(rotuloDaVelocidade(1)).toBe("1x");
    expect(rotuloDaVelocidade(1.25)).toBe("1,25x");
    expect(rotuloDaVelocidade(0.5)).toBe("0,5x");
  });

  it("mais rápida, o mesmo trecho da música passa em menos tempo real", () => {
    expect(noTempoReal(3, 1.5)).toBe(2);
    expect(noTempoReal(3, 0.5)).toBe(6);
  });
});
