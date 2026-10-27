import type { Nota } from "@/modules/rock/songs";
import { avancar, criarPartida, tocar } from "./partida";
import { resultadoDaPartida, valorDosAcertos } from "./resultado";

const nota = (tempo: number): Nota => ({ tempo, pista: 0, frase: -1, duracao: 0 });

describe("resultadoDaPartida", () => {
  it("resume a partida para a tela de resultado e os recordes", () => {
    const partida = criarPartida([nota(1), nota(2), nota(3)]);
    tocar(partida, 0, 1);
    tocar(partida, 0, 2);
    avancar(partida, 4);
    expect(resultadoDaPartida(partida, "musica", "expert")).toEqual({
      musicaId: "musica",
      dificuldade: "expert",
      instrumento: "guitarra",
      pontos: 100,
      acertos: 2,
      total: 3,
      julgamentos: { perfeito: 2, otimo: 0, bom: 0 },
      precisao: 2 / 3,
      maiorSequencia: 2,
      derrota: false,
      fantasma: false,
    });
  });

  it("arredonda os pontos dos sustains", () => {
    const partida = criarPartida([nota(1)]);
    partida.pontos = 123.7;
    expect(resultadoDaPartida(partida, "m", "facil").pontos).toBe(124);
  });

  it("guarda o instrumento tocado; sem ele, é a guitarra", () => {
    const partida = criarPartida([nota(1)]);
    expect(resultadoDaPartida(partida, "m", "facil", "baixo").instrumento).toBe("baixo");
    expect(resultadoDaPartida(partida, "m", "facil").instrumento).toBe("guitarra");
  });
});

describe("valorDosAcertos", () => {
  it("soma o valor de cada acerto pelo julgamento, como a precisão do jogo", () => {
    expect(valorDosAcertos({ perfeito: 2, otimo: 1, bom: 1 })).toBe(2 * 300 + 200 + 100);
  });
});
