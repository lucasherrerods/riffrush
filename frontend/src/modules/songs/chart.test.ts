import { adicionarSustains } from "./chart";
import type { Nota } from "./tipos";

const nota = (tempo: number, pista = 0): Nota => ({ tempo, pista, frase: -1, duracao: 0 });

describe("adicionarSustains", () => {
  it("segura a nota até um pouco antes da próxima quando há espaço", () => {
    const [primeira] = adicionarSustains([nota(0), nota(1)], 0.5, 0.2);
    expect(primeira.duracao).toBeCloseTo(0.8);
  });

  it("não cria sustain quando a próxima nota está perto", () => {
    const [primeira] = adicionarSustains([nota(0), nota(0.3)], 0.5, 0.2);
    expect(primeira.duracao).toBe(0);
  });

  it("dá o mesmo sustain para as notas de um acorde", () => {
    const [a, b] = adicionarSustains([nota(0, 0), nota(0, 2), nota(1)], 0.5, 0.2);
    expect(a.duracao).toBeCloseTo(0.8);
    expect(b.duracao).toBeCloseTo(0.8);
  });
});
