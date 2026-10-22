import type { Nota } from "@/modules/songs";
import { JANELA_DE_ACERTO, ativarEstrela, avancar, criarPartida, multiplicador, precisao, retirarEventos, soltar, tocar } from "./partida";

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

describe("sustain", () => {
  const comSustain = () => {
    const partida = criarPartida([nota(1, 0, { duracao: 1 })]);
    tocar(partida, 0, 1);
    return partida;
  };

  it("ganha pontos enquanto segura a nota", () => {
    const partida = comSustain();
    const depoisDoAcerto = partida.pontos;
    avancar(partida, 1.5);
    expect(partida.notas[0].segurando).toBe(true);
    expect(partida.pontos).toBeGreaterThan(depoisDoAcerto);
  });

  it("termina sozinho no fim da nota", () => {
    const partida = comSustain();
    avancar(partida, 2.1);
    expect(partida.notas[0]).toMatchObject({ segurando: false, solta: false });
  });

  it("soltar antes do fim larga a nota e para de pontuar", () => {
    const partida = comSustain();
    avancar(partida, 1.3);
    soltar(partida, 0, 1.3);
    const aoSoltar = partida.pontos;
    avancar(partida, 2);
    expect(partida.notas[0].solta).toBe(true);
    expect(partida.pontos).toBe(aoSoltar);
  });

  it("soltar quase no fim conta como completo", () => {
    const partida = comSustain();
    soltar(partida, 0, 1.95);
    expect(partida.notas[0].solta).toBe(false);
  });

  it("não tira a nota da lista enquanto ela está sendo segurada", () => {
    const partida = comSustain();
    avancar(partida, 1.8);
    expect(partida.primeira).toBe(0);
  });
});

describe("star power", () => {
  const frase = (id: number, inicio: number) => [nota(inicio, 0, { frase: id }), nota(inicio + 1, 1, { frase: id })];
  const completar = (partida: ReturnType<typeof criarPartida>, inicio: number) => {
    tocar(partida, 0, inicio);
    tocar(partida, 1, inicio + 1);
  };

  it("completar uma frase enche 25% da barra", () => {
    const partida = criarPartida(frase(0, 1));
    completar(partida, 1);
    expect(partida.estrela).toBeCloseTo(0.25);
    expect(retirarEventos(partida)).toContainEqual({ tipo: "fraseCompleta" });
  });

  it("errar uma nota da frase cancela o bônus", () => {
    const partida = criarPartida(frase(0, 1));
    tocar(partida, 0, 1);
    avancar(partida, 2.5);
    expect(partida.estrela).toBe(0);
  });

  it("avisa quando a barra passa da metade", () => {
    const partida = criarPartida([...frase(0, 1), ...frase(1, 3)]);
    completar(partida, 1);
    completar(partida, 3);
    expect(retirarEventos(partida)).toContainEqual({ tipo: "estrelaPronta" });
  });

  it("só ativa com pelo menos metade da barra", () => {
    const partida = criarPartida(frase(0, 1));
    completar(partida, 1);
    expect(ativarEstrela(partida)).toBe(false);
  });

  it("ativada, dobra o multiplicador e esvazia com o tempo", () => {
    const partida = criarPartida([...frase(0, 1), ...frase(1, 3)]);
    completar(partida, 1);
    completar(partida, 3);
    avancar(partida, 4);
    expect(ativarEstrela(partida)).toBe(true);
    expect(multiplicador(partida)).toBe(2);
    avancar(partida, 8);
    expect(partida.estrela).toBeCloseTo(0.25, 1);
    avancar(partida, 13);
    expect(partida.estrelaAtiva).toBe(false);
    expect(partida.estrela).toBe(0);
  });
});

describe("pontuação", () => {
  it("o multiplicador sobe a cada 10 notas seguidas, até 4x", () => {
    const partida = criarPartida(Array.from({ length: 45 }, (_, i) => nota(i)));
    const multiplicadores: number[] = [];
    for (let i = 0; i < 45; i++) {
      tocar(partida, 0, i);
      if (i % 10 === 9) multiplicadores.push(multiplicador(partida));
    }
    expect(multiplicadores).toEqual([2, 3, 4, 4]);
  });

  it("cada nota vale 50 vezes o multiplicador", () => {
    const partida = criarPartida(Array.from({ length: 11 }, (_, i) => nota(i)));
    for (let i = 0; i < 11; i++) tocar(partida, 0, i);
    expect(partida.pontos).toBe(9 * 50 + 2 * 100);
  });
});

describe("precisao", () => {
  it("é 100% antes de qualquer nota", () => {
    expect(precisao(criarPartida([nota(1)]))).toBe(1);
  });

  it("divide os acertos por todas as notas que já passaram", () => {
    const partida = criarPartida([nota(1), nota(2), nota(3), nota(4)]);
    tocar(partida, 0, 1);
    tocar(partida, 0, 2);
    tocar(partida, 0, 3);
    avancar(partida, 5);
    expect(partida.erros).toBe(1);
    expect(precisao(partida)).toBeCloseTo(0.75);
  });
});
