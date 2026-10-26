import { JANELA_DE_ACERTO, PISTAS, julgarToque, notasDoRiff, notasNaTela } from "./riff";

describe("notasDoRiff", () => {
  it("gera notas em ordem de tempo, todas em pistas válidas", () => {
    const notas = notasDoRiff(8000);
    expect(notas.length).toBeGreaterThan(10);
    notas.forEach((nota, i) => {
      expect(nota.pista).toBeGreaterThanOrEqual(0);
      expect(nota.pista).toBeLessThan(PISTAS);
      if (i > 0) expect(nota.tempo).toBeGreaterThan(notas[i - 1].tempo);
    });
  });

  it("repete o mesmo riff a cada chamada, para a demo ser igual para todo mundo", () => {
    expect(notasDoRiff(5000)).toEqual(notasDoRiff(5000));
  });

  it("não passa da duração pedida", () => {
    expect(notasDoRiff(3000).every((nota) => nota.tempo < 3000)).toBe(true);
  });
});

describe("notasNaTela", () => {
  const notas = [
    { tempo: 1000, pista: 0 },
    { tempo: 2000, pista: 1 },
    { tempo: 5000, pista: 2 },
  ];

  it("mostra só as notas que estão chegando dentro do tempo de antecedência", () => {
    expect(notasNaTela(notas, 900, 1500).map((n) => n.pista)).toEqual([0, 1]);
  });

  it("calcula a posição de 0 (topo) a 1 (alvo)", () => {
    const [nota] = notasNaTela(notas, 500, 1000);
    expect(nota.posicao).toBeCloseTo(0.5);
  });

  it("some com as notas já acertadas", () => {
    expect(notasNaTela(notas, 900, 1500, new Set([0])).map((n) => n.pista)).toEqual([1]);
  });
});

describe("julgarToque", () => {
  const notas = [
    { tempo: 1000, pista: 0 },
    { tempo: 1100, pista: 0 },
    { tempo: 1000, pista: 2 },
  ];

  it("acerta a nota mais próxima da mesma pista dentro da janela", () => {
    expect(julgarToque(notas, 0, 1080, new Set())).toBe(1);
  });

  it("erra quando não há nota da pista dentro da janela", () => {
    expect(julgarToque(notas, 1, 1000, new Set())).toBeNull();
    expect(julgarToque(notas, 2, 1000 + JANELA_DE_ACERTO + 1, new Set())).toBeNull();
  });

  it("não acerta duas vezes a mesma nota", () => {
    expect(julgarToque(notas, 2, 1000, new Set([2]))).toBeNull();
  });
});
