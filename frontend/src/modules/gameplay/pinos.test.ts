import { brilhoDosPinos } from "./pinos";

describe("brilhoDosPinos", () => {
  it("cada pino é um quarto do star power", () => {
    expect(brilhoDosPinos(0)).toEqual([0, 0, 0, 0]);
    expect(brilhoDosPinos(0.5)).toEqual([1, 1, 0, 0]);
    expect(brilhoDosPinos(1)).toEqual([1, 1, 1, 1]);
  });

  it("o pino que está enchendo acende pela metade do caminho", () => {
    expect(brilhoDosPinos(0.375)).toEqual([1, 0.5, 0, 0]);
  });

  it("não passa de aceso nem de apagado", () => {
    expect(brilhoDosPinos(1.4)).toEqual([1, 1, 1, 1]);
    expect(brilhoDosPinos(-0.2)).toEqual([0, 0, 0, 0]);
  });
});
