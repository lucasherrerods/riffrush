import { limitesDaVolta, registrarVolta, rotuloDasVoltas, trechosDaMusica, VOLTAS_INICIAIS, type Batida } from "./treino";

/** Batidas a cada 0,5 s, tempo forte a cada 4: um compasso a cada 2 s. */
const batidas = (duracao: number): Batida[] => Array.from({ length: duracao * 2 + 1 }, (_, i) => ({ tempo: i / 2, forte: i % 4 === 0 }));

describe("trechosDaMusica", () => {
  it("com seções no chart, cada trecho vai do início da seção até a próxima, e a última até o fim da música", () => {
    expect(
      trechosDaMusica(
        [
          { nome: "Intro", inicio: 0 },
          { nome: "Riff", inicio: 8 },
          { nome: "Solo", inicio: 20 },
        ],
        batidas(30),
        30,
      ),
    ).toEqual([
      { nome: "Intro", inicio: 0, fim: 8 },
      { nome: "Riff", inicio: 8, fim: 20 },
      { nome: "Solo", inicio: 20, fim: 30 },
    ]);
  });

  it("um trecho antes da primeira seção vira o começo", () => {
    expect(trechosDaMusica([{ nome: "Verso 1", inicio: 6 }], batidas(10), 10)).toEqual([
      { nome: "Começo", inicio: 0, fim: 6 },
      { nome: "Verso 1", inicio: 6, fim: 10 },
    ]);
  });

  it("seções repetidas no mesmo instante e fora da música são descartadas", () => {
    expect(
      trechosDaMusica(
        [
          { nome: "Intro", inicio: 0 },
          { nome: "Intro B", inicio: 0 },
          { nome: "Fim", inicio: 12 },
        ],
        batidas(10),
        10,
      ),
    ).toEqual([{ nome: "Intro B", inicio: 0, fim: 10 }]);
  });

  it("sem seções, divide em blocos de 8 compassos pelos tempos fortes", () => {
    expect(trechosDaMusica([], batidas(40), 40)).toEqual([
      { nome: "Compassos 1–8", inicio: 0, fim: 16 },
      { nome: "Compassos 9–16", inicio: 16, fim: 32 },
      { nome: "Compassos 17–20", inicio: 32, fim: 40 },
    ]);
  });

  it("um resto curto demais no fim junta com o bloco anterior", () => {
    expect(trechosDaMusica([], batidas(33), 33)).toEqual([
      { nome: "Compassos 1–8", inicio: 0, fim: 16 },
      { nome: "Compassos 9–17", inicio: 16, fim: 33 },
    ]);
  });

  it("sem seções nem batidas, a música inteira é um trecho só", () => {
    expect(trechosDaMusica([], [], 12)).toEqual([{ nome: "Música inteira", inicio: 0, fim: 12 }]);
  });
});

describe("limitesDaVolta", () => {
  it("começa um pouco antes do trecho, para as notas descerem, e acaba com uma folga depois", () => {
    expect(limitesDaVolta({ nome: "Riff", inicio: 10, fim: 20 }, 1, 100)).toEqual({ inicio: 8, fim: 20.5 });
  });

  it("segue a velocidade: na metade, tudo fica no dobro do tempo real", () => {
    expect(limitesDaVolta({ nome: "Riff", inicio: 10, fim: 20 }, 0.5, 200)).toEqual({ inicio: 18, fim: 40.5 });
  });

  it("o trecho do fim acaba antes da música, senão a partida terminaria", () => {
    expect(limitesDaVolta({ nome: "Final", inicio: 90, fim: 100 }, 1, 100).fim).toBeLessThan(100);
  });
});

describe("registrarVolta", () => {
  it("conta a volta e guarda a última e a melhor precisão", () => {
    const uma = registrarVolta(VOLTAS_INICIAIS, 0.8);
    const duas = registrarVolta(uma, 0.95);
    const tres = registrarVolta(duas, 0.9);
    expect(tres).toEqual({ voltas: 3, ultima: 0.9, melhor: 0.95 });
    expect(rotuloDasVoltas(tres)).toBe("volta 4 · última 90% · melhor 95%");
    expect(rotuloDasVoltas(VOLTAS_INICIAIS)).toBe("");
  });
});
