import { vizinhasParaPreCarregar, LIMITE_PARA_REINICIAR, acaoDeVoltar, formatarTempo, indiceSorteado, indiceVizinho, pontoAleatorioDeInicio, pontoDaPartida, pontoDeRetomada, pontoDeVolta, posicaoNaMusica } from "./fila";

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

describe("pontoAleatorioDeInicio", () => {
  it("fica entre 30% e 70% da duração", () => {
    expect(pontoAleatorioDeInicio(100, 0)).toBe(30);
    expect(pontoAleatorioDeInicio(100, 0.5)).toBe(50);
    expect(pontoAleatorioDeInicio(100, 0.999999)).toBeCloseTo(70);
  });
});

describe("pontoDaPartida", () => {
  it("é o tempo desde o início vezes a velocidade do áudio", () => {
    expect(pontoDaPartida(10, 30, 1)).toBe(20);
    expect(pontoDaPartida(10, 30, 1.5)).toBe(30);
  });

  it("antes da música começar é o zero", () => {
    expect(pontoDaPartida(10, 7, 1)).toBe(0);
  });
});

describe("pontoDeRetomada", () => {
  it("volta de onde o jogador saiu", () => {
    expect(pontoDeRetomada(42, 180)).toBe(42);
  });

  it("no fim da música recomeça do começo, para não pular de música", () => {
    expect(pontoDeRetomada(180, 180)).toBe(0);
    expect(pontoDeRetomada(200, 180)).toBe(0);
    expect(pontoDeRetomada(180 - LIMITE_PARA_REINICIAR + 0.1, 180)).toBe(0);
  });

  it("nunca é negativo", () => {
    expect(pontoDeRetomada(-1, 180)).toBe(0);
  });
});

describe("indiceSorteado", () => {
  it("escolhe uma posição da fila pelo sorteio", () => {
    expect(indiceSorteado(3, 0)).toBe(0);
    expect(indiceSorteado(3, 0.5)).toBe(1);
    expect(indiceSorteado(3, 0.999)).toBe(2);
  });

  it("sem músicas não há posição", () => {
    expect(indiceSorteado(0, 0.5)).toBe(-1);
  });
});

describe("pontoDeVolta", () => {
  it("saindo por conta própria, continua de onde o jogador saiu", () => {
    expect(pontoDeVolta({ tipo: "saiu", segundos: 42 }, 180, 0.5)).toBe(42);
  });

  it("depois de uma falha, é como entrar pela seleção: um ponto sorteado do meio", () => {
    expect(pontoDeVolta({ tipo: "falhou" }, 100, 0.5)).toBe(50);
  });
});

describe("vizinhasParaPreCarregar", () => {
  it("pega as vizinhas mais perto primeiro, dando a volta nas pontas", () => {
    expect(vizinhasParaPreCarregar(5, 0, 2)).toEqual([1, 4, 2, 3]);
  });

  it("não repete a atual nem a mesma vizinha em fila curta", () => {
    expect(vizinhasParaPreCarregar(2, 0, 2)).toEqual([1]);
    expect(vizinhasParaPreCarregar(1, 0, 2)).toEqual([]);
  });

  it("fora da fila não há vizinhas", () => {
    expect(vizinhasParaPreCarregar(5, -1, 2)).toEqual([]);
  });
});
