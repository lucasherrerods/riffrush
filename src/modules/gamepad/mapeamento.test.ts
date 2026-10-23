import { BOTOES, direcoesDoAnalogico, juntarAnalogico, traduzir, type Mapa } from "./mapeamento";

const mapa: Mapa = { teclas: ["KeyA", "KeyS", "KeyJ", "KeyK", "KeyL"], teclaDaEstrela: "Space" };
const solto = () => Array<boolean>(17).fill(false);
const com = (...botoes: number[]) => {
  const estado = solto();
  for (const b of botoes) estado[b] = true;
  return estado;
};
const vazio = () => Array.from({ length: 17 }, () => [] as string[]);

describe("traduzir no jogo", () => {
  it("os trastes ficam em LT, LB, RB, RT e A", () => {
    const ordem = [BOTOES.LT, BOTOES.LB, BOTOES.RB, BOTOES.RT, BOTOES.A];
    ordem.forEach((botao, pista) => {
      const { eventos } = traduzir(solto(), com(botao), vazio(), "jogo", mapa);
      expect(eventos).toContainEqual({ tipo: "keydown", code: mapa.teclas[pista] });
    });
  });

  it("segue as teclas que o jogador configurou", () => {
    const { eventos } = traduzir(solto(), com(BOTOES.LT), vazio(), "jogo", { ...mapa, teclas: ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT"] });
    expect(eventos).toContainEqual({ tipo: "keydown", code: "KeyQ" });
  });

  it("soltar o botão solta a tecla", () => {
    const apertou = traduzir(solto(), com(BOTOES.LB), vazio(), "jogo", mapa);
    const { eventos } = traduzir(com(BOTOES.LB), solto(), apertou.emitidos, "jogo", mapa);
    expect(eventos).toEqual([{ tipo: "keyup", code: "KeyS" }]);
  });

  it("segurar o botão não repete a tecla", () => {
    const apertou = traduzir(solto(), com(BOTOES.LT), vazio(), "jogo", mapa);
    expect(traduzir(com(BOTOES.LT), com(BOTOES.LT), apertou.emitidos, "jogo", mapa).eventos).toEqual([]);
  });

  it("palhetar no direcional toca de novo os trastes segurados", () => {
    const segurando = traduzir(solto(), com(BOTOES.LT, BOTOES.RB), vazio(), "jogo", mapa);
    const { eventos } = traduzir(com(BOTOES.LT, BOTOES.RB), com(BOTOES.LT, BOTOES.RB, BOTOES.BAIXO), segurando.emitidos, "jogo", mapa);
    for (const code of ["KeyA", "KeyJ"]) {
      expect(eventos).toContainEqual({ tipo: "keyup", code });
      expect(eventos).toContainEqual({ tipo: "keydown", code });
    }
  });

  it("Select ativa o star power e Start pausa", () => {
    expect(traduzir(solto(), com(BOTOES.SELECT), vazio(), "jogo", mapa).eventos).toContainEqual({ tipo: "keydown", code: "Space" });
    expect(traduzir(solto(), com(BOTOES.START), vazio(), "jogo", mapa).eventos).toContainEqual({ tipo: "keydown", code: "Escape" });
  });

  it("B não pausa no meio da música", () => {
    expect(traduzir(solto(), com(BOTOES.B), vazio(), "jogo", mapa).eventos).toEqual([]);
  });

  it("A confirma no menu de pausa", () => {
    expect(traduzir(solto(), com(BOTOES.A), vazio(), "jogo", mapa).eventos).toContainEqual({ tipo: "keydown", code: "Enter" });
  });
});

describe("traduzir nos menus", () => {
  it("A confirma, B volta e o direcional navega", () => {
    expect(traduzir(solto(), com(BOTOES.A), vazio(), "menu", mapa).eventos).toEqual([{ tipo: "keydown", code: "Enter" }]);
    expect(traduzir(solto(), com(BOTOES.B), vazio(), "menu", mapa).eventos).toEqual([{ tipo: "keydown", code: "Escape" }]);
    expect(traduzir(solto(), com(BOTOES.ESQUERDA), vazio(), "menu", mapa).eventos).toEqual([{ tipo: "keydown", code: "ArrowLeft" }]);
  });

  // Bug evitado: trocar de tela com o botão apertado deixava a tecla da tela antiga presa.
  it("solta a mesma tecla que apertou, mesmo se o modo mudou no meio", () => {
    const apertou = traduzir(solto(), com(BOTOES.A), vazio(), "menu", mapa);
    expect(traduzir(com(BOTOES.A), solto(), apertou.emitidos, "jogo", mapa).eventos).toEqual([{ tipo: "keyup", code: "Enter" }]);
  });
});

describe("direcoesDoAnalogico", () => {
  const nenhuma = [false, false, false, false];

  it("vira cima, baixo, esquerda e direita quando passa do meio do curso", () => {
    expect(direcoesDoAnalogico([0, -0.8], nenhuma)).toEqual([true, false, false, false]);
    expect(direcoesDoAnalogico([0, 0.8], nenhuma)).toEqual([false, true, false, false]);
    expect(direcoesDoAnalogico([-0.8, 0], nenhuma)).toEqual([false, false, true, false]);
    expect(direcoesDoAnalogico([0.8, 0], nenhuma)).toEqual([false, false, false, true]);
  });

  it("ignora a folga do analógico parado", () => {
    expect(direcoesDoAnalogico([0.2, -0.3], nenhuma)).toEqual(nenhuma);
  });

  it("na diagonal fica só com o eixo mais inclinado, para não pular duas coisas de uma vez", () => {
    expect(direcoesDoAnalogico([0.6, 0.8], nenhuma)).toEqual([false, true, false, false]);
  });

  // Sem a diferença entre apertar e soltar, o analógico tremendo perto do limite apertaria várias vezes.
  it("só solta quando volta bem para o centro", () => {
    const cima = [true, false, false, false];
    expect(direcoesDoAnalogico([0, -0.4], cima)).toEqual(cima);
    expect(direcoesDoAnalogico([0, -0.4], nenhuma)).toEqual(nenhuma);
    expect(direcoesDoAnalogico([0, -0.2], cima)).toEqual(nenhuma);
  });

  it("funciona com controle sem eixos", () => {
    expect(direcoesDoAnalogico([], nenhuma)).toEqual(nenhuma);
  });
});

describe("juntarAnalogico", () => {
  it("nos menus, o analógico aperta o direcional", () => {
    const botoes = juntarAnalogico(solto(), [true, false, false, true], "menu");
    expect(botoes[BOTOES.CIMA]).toBe(true);
    expect(botoes[BOTOES.DIREITA]).toBe(true);
    expect(botoes[BOTOES.BAIXO]).toBe(false);
  });

  it("no jogo, o analógico não palheta", () => {
    expect(juntarAnalogico(solto(), [false, true, false, false], "jogo")).toEqual(solto());
  });

  it("não perde o direcional apertado de verdade", () => {
    expect(juntarAnalogico(com(BOTOES.ESQUERDA), [false, false, false, false], "menu")[BOTOES.ESQUERDA]).toBe(true);
  });
});
