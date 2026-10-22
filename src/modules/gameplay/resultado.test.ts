import type { Nota } from "@/modules/songs";
import { avancar, criarPartida, tocar } from "./partida";
import { resultadoDaPartida } from "./resultado";

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
      pontos: 100,
      acertos: 2,
      total: 3,
      maiorSequencia: 2,
      derrota: false,
    });
  });

  it("arredonda os pontos dos sustains", () => {
    const partida = criarPartida([nota(1)]);
    partida.pontos = 123.7;
    expect(resultadoDaPartida(partida, "m", "facil").pontos).toBe(124);
  });
});
