import { QUEDA_S, estadoNoInstante, ordenar, tocarNota, type Roteiro } from "./roteiro";

const roteiro: Roteiro = {
  duracao: 4,
  notas: [
    { tempo: 2, pista: 1 },
    { tempo: 2.5, pista: 2, resultado: "erro" },
    { tempo: 3, pista: 0, duracao: 0.5 },
  ],
  entradas: ordenar(tocarNota(2, 1, { palheta: true }), [{ tempo: 2.8, tipo: "palhetaEmVao" }]),
  legendas: [{ de: 0, ate: 2, texto: "As notas descem" }],
  comPalheta: true,
};

describe("estadoNoInstante", () => {
  it("a nota desce do topo até a linha de acerto no tempo dela", () => {
    expect(estadoNoInstante(roteiro, 2 - QUEDA_S).notas.find((n) => n.pista === 1)?.posicao).toBeCloseTo(0);
    expect(estadoNoInstante(roteiro, 2 - QUEDA_S / 2).notas.find((n) => n.pista === 1)?.posicao).toBeCloseTo(0.5);
  });

  it("a acertada some na linha com um brilho; a perdida passa apagada com um X", () => {
    const depois = estadoNoInstante(roteiro, 2.6);
    expect(depois.notas.some((n) => n.pista === 1)).toBe(false);
    expect(depois.notas.find((n) => n.pista === 2)?.passou).toBe(true);
    expect(depois.retornos).toContainEqual(expect.objectContaining({ pista: 2, tipo: "erro" }));
  });

  it("o sustain acertado fica na linha até acabar", () => {
    expect(estadoNoInstante(roteiro, 3.2).notas.find((n) => n.pista === 0)?.posicao).toBe(1);
    expect(estadoNoInstante(roteiro, 3.6).notas.some((n) => n.pista === 0)).toBe(false);
  });

  it("mostra os trastes apertados, a palheta e a legenda da hora", () => {
    const naNota = estadoNoInstante(roteiro, 2.01);
    expect(naNota.apertados.has(1)).toBe(true);
    expect(naNota.palhetando).toBe(true);
    expect(estadoNoInstante(roteiro, 1).legenda).toBe("As notas descem");
    expect(estadoNoInstante(roteiro, 3).legenda).toBeNull();
  });

  it("a sequência sobe a cada acerto e zera no erro e na palhetada em vão", () => {
    expect(estadoNoInstante(roteiro, 2.1).sequencia).toBe(1);
    expect(estadoNoInstante(roteiro, 2.6).sequencia).toBe(0);
    expect(estadoNoInstante(roteiro, 2.85).emVao).toBe(true);
  });
});
