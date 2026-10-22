import { BOTOES, traduzir, type Mapa } from "./mapeamento";

const mapa: Mapa = { teclas: ["KeyA", "KeyS", "KeyJ", "KeyK", "KeyL"], teclaDaEstrela: "Space" };
const solto = () => Array<boolean>(17).fill(false);
const com = (...botoes: number[]) => {
  const estado = solto();
  for (const b of botoes) estado[b] = true;
  return estado;
};
const vazio = () => Array.from({ length: 17 }, () => [] as string[]);

describe("traduzir no jogo", () => {
  it("os trastes seguem o Guitar Hero: A, B, Y, X e LB", () => {
    const ordem = [BOTOES.A, BOTOES.B, BOTOES.Y, BOTOES.X, BOTOES.LB];
    ordem.forEach((botao, pista) => {
      const { eventos } = traduzir(solto(), com(botao), vazio(), "jogo", mapa);
      expect(eventos).toContainEqual({ tipo: "keydown", code: mapa.teclas[pista] });
    });
  });

  it("segue as teclas que o jogador configurou", () => {
    const { eventos } = traduzir(solto(), com(BOTOES.A), vazio(), "jogo", { ...mapa, teclas: ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT"] });
    expect(eventos).toContainEqual({ tipo: "keydown", code: "KeyQ" });
  });

  it("soltar o botão solta a tecla", () => {
    const apertou = traduzir(solto(), com(BOTOES.B), vazio(), "jogo", mapa);
    const { eventos } = traduzir(com(BOTOES.B), solto(), apertou.emitidos, "jogo", mapa);
    expect(eventos).toEqual([{ tipo: "keyup", code: "KeyS" }]);
  });

  it("segurar o botão não repete a tecla", () => {
    const apertou = traduzir(solto(), com(BOTOES.A), vazio(), "jogo", mapa);
    expect(traduzir(com(BOTOES.A), com(BOTOES.A), apertou.emitidos, "jogo", mapa).eventos).toEqual([]);
  });

  it("palhetar no direcional toca de novo os trastes segurados", () => {
    const segurando = traduzir(solto(), com(BOTOES.A, BOTOES.Y), vazio(), "jogo", mapa);
    const { eventos } = traduzir(com(BOTOES.A, BOTOES.Y), com(BOTOES.A, BOTOES.Y, BOTOES.BAIXO), segurando.emitidos, "jogo", mapa);
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
    expect(traduzir(solto(), com(BOTOES.B), vazio(), "jogo", mapa).eventos).not.toContainEqual({ tipo: "keydown", code: "Escape" });
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
