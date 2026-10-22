import type { Nota } from "@/modules/songs";
import { JANELA_DE_ACERTO, avancar, criarPartida, retirarEventos, tocar } from "./partida";

const nota = (tempo: number, pista = 0, extra: Partial<Nota> = {}): Nota => ({ tempo, pista, frase: -1, duracao: 0, ...extra });

describe("tocar", () => {
  it("acerta a nota da pista dentro da janela de acerto", () => {
    const partida = criarPartida([nota(1)]);
    expect(tocar(partida, 0, 1 + JANELA_DE_ACERTO * 0.9)).toBe(true);
    expect(partida.notas[0].acertada).toBe(true);
    expect(partida.acertos).toBe(1);
  });

  it("não acerta fora da janela", () => {
    const partida = criarPartida([nota(1)]);
    expect(tocar(partida, 0, 1 - JANELA_DE_ACERTO * 1.5)).toBe(false);
    expect(partida.notas[0].acertada).toBe(false);
  });

  it("não acerta nota de outra pista", () => {
    expect(tocar(criarPartida([nota(1, 2)]), 0, 1)).toBe(false);
  });

  it("escolhe a nota mais próxima quando duas cabem na janela", () => {
    const partida = criarPartida([nota(1), nota(1.08)]);
    tocar(partida, 0, 1.07);
    expect(partida.notas.map((n) => n.acertada)).toEqual([false, true]);
  });

  it("acerta cada nota de um acorde com a sua tecla", () => {
    const partida = criarPartida([nota(1, 0), nota(1, 2)]);
    tocar(partida, 0, 1);
    tocar(partida, 2, 1);
    expect(partida.acertos).toBe(2);
  });

  it("aumenta a sequência e a vida a cada acerto", () => {
    const partida = criarPartida([nota(1), nota(2)]);
    tocar(partida, 0, 1);
    tocar(partida, 0, 2);
    expect(partida.sequencia).toBe(2);
    expect(partida.vida).toBeGreaterThan(0.5);
  });

  it("avisa a cada 50 notas seguidas", () => {
    const partida = criarPartida(Array.from({ length: 50 }, (_, i) => nota(i)));
    for (let i = 0; i < 50; i++) tocar(partida, 0, i);
    expect(retirarEventos(partida)).toContainEqual({ tipo: "sequencia", valor: 50 });
  });
});

describe("avancar", () => {
  it("marca como perdida a nota que passou da janela", () => {
    const partida = criarPartida([nota(1)]);
    avancar(partida, 1 + JANELA_DE_ACERTO + 0.01);
    expect(partida.notas[0].perdida).toBe(true);
    expect(retirarEventos(partida)).toContainEqual(expect.objectContaining({ tipo: "erro" }));
  });

  it("zera a sequência e tira vida no erro", () => {
    const partida = criarPartida([nota(1), nota(2)]);
    tocar(partida, 0, 1);
    avancar(partida, 3);
    expect(partida.sequencia).toBe(0);
    expect(partida.vida).toBeLessThan(0.52);
  });

  // Bug do projeto antigo: a varredura de notas perdidas podia entrar em loop infinito.
  it("marca todas as notas perdidas quando o tempo pula muito de uma vez", () => {
    const partida = criarPartida(Array.from({ length: 100 }, (_, i) => nota(i * 0.1)), { semFalha: true });
    avancar(partida, 60);
    expect(partida.notas.every((n) => n.perdida)).toBe(true);
  });

  it("perde a partida quando a vida acaba", () => {
    const partida = criarPartida(Array.from({ length: 30 }, (_, i) => nota(i)));
    avancar(partida, 40);
    expect(partida.derrota).toBe(true);
    expect(retirarEventos(partida)).toContainEqual({ tipo: "derrota" });
  });

  it("no modo sem falha a vida acaba mas a partida continua", () => {
    const partida = criarPartida(Array.from({ length: 30 }, (_, i) => nota(i)), { semFalha: true });
    avancar(partida, 40);
    expect(partida.vida).toBe(0);
    expect(partida.derrota).toBe(false);
  });

  it("não aceita mais toques depois da derrota", () => {
    const partida = criarPartida([...Array.from({ length: 30 }, (_, i) => nota(i)), nota(50)]);
    avancar(partida, 40);
    expect(tocar(partida, 0, 50)).toBe(false);
  });
});
