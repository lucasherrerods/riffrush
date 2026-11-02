import type { Nota } from "@/modules/rock/songs";
import { notasDoTrecho } from "./treino";

const nota = (tempo: number, duracao = 0): Nota => ({ tempo, pista: 0, duracao, frase: -1 });

describe("notasDoTrecho", () => {
  it("fica só com as notas que começam dentro do trecho", () => {
    const notas = [nota(1), nota(2), nota(3.99), nota(4)];
    expect(notasDoTrecho(notas, { nome: "Riff", inicio: 2, fim: 4 }).map((n) => n.tempo)).toEqual([2, 3.99]);
  });

  it("corta o sustain que passa do fim do trecho", () => {
    expect(notasDoTrecho([nota(2, 5)], { nome: "Riff", inicio: 2, fim: 4 })[0].duracao).toBe(2);
  });

  it("não mexe nas notas originais", () => {
    const notas = [nota(2, 5)];
    notasDoTrecho(notas, { nome: "Riff", inicio: 2, fim: 4 });
    expect(notas[0].duracao).toBe(5);
  });
});
