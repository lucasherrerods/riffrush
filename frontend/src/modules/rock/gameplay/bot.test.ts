import type { Nota } from "@/modules/rock/songs";
import { criarBot, jogarSozinho } from "./bot";
import { avancar, criarPartida } from "./partida";

const nota = (tempo: number, pista = 0, extra: Partial<Nota> = {}): Nota => ({ tempo, pista, frase: -1, duracao: 0, ...extra });

function jogar(notas: Nota[], ate: number, passo: number) {
  const partida = criarPartida(notas);
  const bot = criarBot();
  for (let tempo = -1; tempo <= ate; tempo += passo) {
    jogarSozinho(bot, partida, tempo);
    avancar(partida, tempo);
  }
  return partida;
}

describe("bot", () => {
  it("acerta todas as notas", () => {
    const partida = jogar([nota(0.5, 0), nota(1, 3), nota(1, 1), nota(1.5, 4)], 2, 1 / 60);
    expect(partida.acertos).toBe(4);
  });

  // Bug do projeto antigo: com frames espaçados, as notas saíam da janela antes de o bot chegar nelas.
  it("acerta todas mesmo quando os frames chegam espaçados", () => {
    const partida = jogar([nota(0.5), nota(0.6, 1), nota(0.7, 2)], 2, 0.5);
    expect(partida.acertos).toBe(3);
  });

  // Bug do projeto antigo: os 5 trastes apareciam apertados durante a contagem.
  it("não aperta nenhum traste antes da música começar", () => {
    const bot = criarBot();
    expect(jogarSozinho(bot, criarPartida([nota(1)]), -2)).toEqual([false, false, false, false, false, false]);
  });

  it("segura o traste durante o sustain", () => {
    const partida = criarPartida([nota(1, 2, { duracao: 1 })]);
    const bot = criarBot();
    jogarSozinho(bot, partida, 1);
    expect(jogarSozinho(bot, partida, 1.5)[2]).toBe(true);
    expect(jogarSozinho(bot, partida, 2.1)[2]).toBe(false);
  });

  it("ativa o star power quando a barra está pronta", () => {
    const frase = (id: number, t: number) => [nota(t, 0, { frase: id }), nota(t + 0.5, 1, { frase: id })];
    const partida = jogar([...frase(0, 1), ...frase(1, 2)], 3, 1 / 60);
    expect(partida.estrelaAtiva).toBe(true);
  });
});
