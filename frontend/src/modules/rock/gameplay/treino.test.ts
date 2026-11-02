import type { Nota } from "@/modules/rock/songs";
import { limitesDaVolta, notasDoTrecho, registrarVolta, VOLTAS_INICIAIS } from "./treino";

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
  });
});
