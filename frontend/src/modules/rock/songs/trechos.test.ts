import { trechosDaMusica } from "./trechos";
import type { Batida } from "./tipos";

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
