import { LIMITE_PARA_REINICIAR, acaoDeVoltar, formatarTempo, indiceVizinho, posicaoNaMusica } from "./fila";

describe("indiceVizinho", () => {
  it("dá a volta nas pontas da fila", () => {
    expect(indiceVizinho(3, 2, 1)).toBe(0);
    expect(indiceVizinho(3, 0, -1)).toBe(2);
    expect(indiceVizinho(3, 1, 1)).toBe(2);
  });

  it("sem músicas não há vizinho", () => {
    expect(indiceVizinho(0, 0, 1)).toBe(-1);
  });
});

describe("acaoDeVoltar", () => {
  it("no começo da música volta para a anterior", () => {
    expect(acaoDeVoltar(1)).toBe("anterior");
  });

  it("depois de alguns segundos reinicia a mesma", () => {
    expect(acaoDeVoltar(LIMITE_PARA_REINICIAR + 1)).toBe("reiniciar");
  });
});

describe("posicaoNaMusica", () => {
  it("tocando, conta o tempo desde o início", () => {
    expect(posicaoNaMusica(true, 0, 10, 15, 100)).toBe(5);
  });

  it("pausada, fica onde parou", () => {
    expect(posicaoNaMusica(false, 42, 10, 99, 100)).toBe(42);
  });

  it("não passa do fim nem fica negativa", () => {
    expect(posicaoNaMusica(true, 0, 0, 500, 100)).toBe(100);
    expect(posicaoNaMusica(true, 0, 10, 5, 100)).toBe(0);
  });
});

describe("formatarTempo", () => {
  it("mostra minutos e segundos", () => {
    expect(formatarTempo(0)).toBe("0:00");
    expect(formatarTempo(65.9)).toBe("1:05");
  });
});
