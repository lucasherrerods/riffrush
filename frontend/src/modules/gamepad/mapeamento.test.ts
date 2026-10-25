import {
  BOTAO_DA_ESTRELA_PADRAO,
  BOTOES,
  BOTOES_DOS_TRASTES_PADRAO,
  direcoesDoAnalogico,
  juntarAnalogico,
  nomeDoBotao,
  podeSerEscolhido,
  traduzir,
  type Mapa,
} from "./mapeamento";

const mapa: Mapa = {
  teclas: ["KeyA", "KeyS", "KeyJ", "KeyK", "KeyL", "KeyD"],
  teclaDaEstrela: "Space",
  botoesDoControle: BOTOES_DOS_TRASTES_PADRAO,
  botaoDaEstrela: BOTAO_DA_ESTRELA_PADRAO,
};
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

  it("segue os botões que o jogador escolheu para o controle", () => {
    const escolhidos = { ...mapa, botoesDoControle: [BOTOES.X, BOTOES.Y, BOTOES.B, BOTOES.A, BOTOES.RB], botaoDaEstrela: BOTOES.LB };
    expect(traduzir(solto(), com(BOTOES.X), vazio(), "jogo", escolhidos).eventos).toEqual([{ tipo: "keydown", code: "KeyA" }]);
    expect(traduzir(solto(), com(BOTOES.LB), vazio(), "jogo", escolhidos).eventos).toEqual([{ tipo: "keydown", code: "Space" }]);
    // LT deixou de ser traste.
    expect(traduzir(solto(), com(BOTOES.LT), vazio(), "jogo", escolhidos).eventos).toEqual([]);
    // Palhetar toca de novo os trastes novos.
    const segurando = traduzir(solto(), com(BOTOES.X), vazio(), "jogo", escolhidos);
    expect(traduzir(com(BOTOES.X), com(BOTOES.X, BOTOES.CIMA), segurando.emitidos, "jogo", escolhidos).eventos).toContainEqual({ tipo: "keydown", code: "KeyA" });
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

  it("Y troca o instrumento, como o Tab do teclado", () => {
    expect(traduzir(solto(), com(BOTOES.Y), vazio(), "menu", mapa).eventos).toEqual([{ tipo: "keydown", code: "Tab" }]);
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

describe("botões do controle", () => {
  it("têm nome conhecido no layout padrão e um número nos outros", () => {
    expect(nomeDoBotao(BOTOES.LT)).toBe("LT");
    expect(nomeDoBotao(BOTOES.SELECT)).toBe("Select");
    expect(nomeDoBotao(20)).toBe("Botão 21");
  });

  it("o direcional e o Start não podem virar traste", () => {
    expect(podeSerEscolhido(BOTOES.X)).toBe(true);
    expect(podeSerEscolhido(BOTOES.BAIXO)).toBe(false);
    expect(podeSerEscolhido(BOTOES.START)).toBe(false);
  });
});
