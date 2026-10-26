import { PISTA_ABERTA, type Nota } from "@/modules/songs";
import { JANELA_DE_ACERTO, ativarEstrela, avancar, criarPartida, julgar, multiplicador, precisao, retirarEventos, soltar, tocar } from "./partida";

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

  it("a nota aberta só sai com a tecla dela, e a tecla dela não toca trastes", () => {
    const partida = criarPartida([nota(1, PISTA_ABERTA), nota(2, 0)]);
    expect(tocar(partida, 0, 1)).toBe(false);
    expect(tocar(partida, PISTA_ABERTA, 1)).toBe(true);
    expect(tocar(partida, PISTA_ABERTA, 2)).toBe(false);
    expect(partida.acertos).toBe(1);
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

  describe("fantasma (multijogador)", () => {
    const comFantasma = () => criarPartida([...Array.from({ length: 30 }, (_, i) => nota(i)), nota(50), nota(51)], { fantasma: true });

    it("zerar a vida vira fantasma em vez de perder", () => {
      const partida = comFantasma();
      avancar(partida, 40);
      expect(partida.derrota).toBe(false);
      expect(partida.fantasma).toBe(true);
      expect(retirarEventos(partida).filter((e) => e.tipo === "virouFantasma")).toHaveLength(1);
    });

    it("o fantasma continua tocando, pontuando e recupera a vida acertando", () => {
      const partida = comFantasma();
      avancar(partida, 40);
      const pontos = partida.pontos;
      expect(tocar(partida, 0, 50)).toBe(true);
      expect(partida.pontos).toBeGreaterThan(pontos);
      expect(partida.vida).toBeGreaterThan(0);
    });

    it("a marca de fantasma fica até o fim, mesmo depois de recuperar a vida", () => {
      const partida = comFantasma();
      avancar(partida, 40);
      tocar(partida, 0, 50);
      tocar(partida, 0, 51);
      expect(partida.fantasma).toBe(true);
    });

    it("zerar a vida de novo não repete o aviso", () => {
      const partida = criarPartida([...Array.from({ length: 30 }, (_, i) => nota(i)), nota(50), ...Array.from({ length: 30 }, (_, i) => nota(60 + i))], { fantasma: true });
      avancar(partida, 40);
      tocar(partida, 0, 50);
      avancar(partida, 100);
      expect(retirarEventos(partida).filter((e) => e.tipo === "virouFantasma")).toHaveLength(1);
    });
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

describe("julgar", () => {
  it("dá o julgamento pela distância até a batida", () => {
    expect(julgar(0)).toBe("perfeito");
    expect(julgar(0.035)).toBe("perfeito");
    expect(julgar(-0.036)).toBe("otimo");
    expect(julgar(0.07)).toBe("otimo");
    expect(julgar(0.071)).toBe("bom");
    expect(julgar(-0.11)).toBe("bom");
  });

  it("a janela de acerto acaba onde acaba o bom", () => {
    expect(JANELA_DE_ACERTO).toBe(0.11);
  });
});

describe("precisao", () => {
  it("é 100% antes de qualquer nota", () => {
    expect(precisao(criarPartida([nota(1)]))).toBe(1);
  });

  it("conta os julgamentos de cada acerto", () => {
    const partida = criarPartida([nota(1), nota(2), nota(3)]);
    tocar(partida, 0, 1.01);
    tocar(partida, 0, 2.05);
    tocar(partida, 0, 2.91);
    expect(partida.julgamentos).toEqual({ perfeito: 1, otimo: 1, bom: 1 });
  });

  it("soma o valor de cada nota sobre o máximo das que já passaram, e a nota perdida vale zero", () => {
    const partida = criarPartida([nota(1), nota(2), nota(3), nota(4)]);
    tocar(partida, 0, 1);
    tocar(partida, 0, 2.05);
    tocar(partida, 0, 3.1);
    avancar(partida, 5);
    expect(partida.erros).toBe(1);
    expect(precisao(partida)).toBeCloseTo((300 + 100 + 50 + 0) / (4 * 300));
  });

  it("avisa o julgamento junto do acerto", () => {
    const partida = criarPartida([nota(1)]);
    tocar(partida, 0, 1.05);
    expect(retirarEventos(partida)).toContainEqual(expect.objectContaining({ tipo: "acerto", julgamento: "otimo" }));
  });
});

describe("acerto ao soltar", () => {
  it("soltar a tecla acerta a próxima nota da mesma pista se o aperto acertou", () => {
    const partida = criarPartida([nota(1), nota(1.08)]);
    tocar(partida, 0, 1);
    soltar(partida, 0, 1.05);
    expect(partida.notas[1].acertada).toBe(true);
    expect(partida.acertos).toBe(2);
  });

  it("não acerta ao soltar se o aperto errou", () => {
    const partida = criarPartida([nota(1.05)]);
    tocar(partida, 0, 0.5);
    soltar(partida, 0, 1.05);
    expect(partida.notas[0].acertada).toBe(false);
  });

  it("só uma soltura por aperto: a seguinte precisa de aperto novo", () => {
    const partida = criarPartida([nota(1), nota(1.05), nota(1.1)]);
    tocar(partida, 0, 1);
    soltar(partida, 0, 1.05);
    soltar(partida, 0, 1.1);
    expect(partida.notas[2].acertada).toBe(false);
  });

  it("não acerta nota de outra pista", () => {
    const partida = criarPartida([nota(1), nota(1.05, 1)]);
    tocar(partida, 0, 1);
    soltar(partida, 0, 1.05);
    expect(partida.notas[1].acertada).toBe(false);
  });

  it("soltar sem nota por perto não tem castigo", () => {
    const partida = criarPartida([nota(1), nota(3)]);
    tocar(partida, 0, 1);
    soltar(partida, 0, 1.5);
    expect(partida.sequencia).toBe(1);
    expect(partida.erros).toBe(0);
  });

  it("largar um sustain antes do fim não acerta a nota seguinte", () => {
    const partida = criarPartida([nota(1, 0, { duracao: 1 }), nota(1.5)]);
    tocar(partida, 0, 1);
    soltar(partida, 0, 1.5);
    expect(partida.notas[1].acertada).toBe(false);
  });
});

describe("independência dos frames", () => {
  // Uma música com acordes, sustains, frases de star power e notas perdidas de propósito.
  const notas: Nota[] = Array.from({ length: 240 }, (_, i) => ({
    tempo: 1 + i * 0.137 + (i % 3) * 0.011,
    pista: (i * 7) % 5,
    duracao: i % 9 === 0 ? 0.6 : 0,
    frase: i < 120 ? Math.floor(i / 6) : -1,
  }));
  type Entrada = { tempo: number; tipo: "tocar" | "soltar" | "estrela"; pista: number };
  const entradas: Entrada[] = notas
    .flatMap((n, i): Entrada[] =>
      i % 11 === 5
        ? []
        : [
            { tempo: n.tempo + ((i % 5) - 2) * 0.017, tipo: "tocar", pista: n.pista },
            { tempo: n.tempo + Math.max(0.05, n.duracao * (i % 2 ? 1 : 0.5)), tipo: "soltar", pista: n.pista },
          ],
    )
    .concat([10, 22].map((tempo) => ({ tempo, tipo: "estrela" as const, pista: 0 })))
    .sort((a, b) => a.tempo - b.tempo);

  function jogar(passo: number) {
    const partida = criarPartida(notas);
    let proxima = 0;
    const aplicarAte = (tempo: number) => {
      for (; proxima < entradas.length && entradas[proxima].tempo <= tempo; proxima++) {
        const e = entradas[proxima];
        if (e.tipo === "tocar") tocar(partida, e.pista, e.tempo);
        else if (e.tipo === "soltar") soltar(partida, e.pista, e.tempo);
        else {
          avancar(partida, e.tempo);
          ativarEstrela(partida);
        }
      }
    };
    for (let t = 0; t < 40; t += passo) {
      aplicarAte(t);
      avancar(partida, t);
    }
    aplicarAte(40);
    avancar(partida, 40);
    const { pontos, acertos, erros, sequencia, maiorSequencia, estrela, estrelaAtiva, vida } = partida;
    return { pontos, acertos, erros, sequencia, maiorSequencia, estrela, estrelaAtiva, vida };
  }

  it("a mesma partida dá o mesmo resultado a 60 fps, 144 fps, 37 fps ou sem frames no meio", () => {
    const base = jogar(40);
    expect(base.acertos).toBeGreaterThan(150);
    expect(base.erros).toBeGreaterThan(10);
    for (const fps of [60, 144, 37]) expect(jogar(1 / fps)).toEqual(base);
  });
});
