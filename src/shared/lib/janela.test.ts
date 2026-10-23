import { janelaEmVolta } from "./janela";

describe("janelaEmVolta", () => {
  it("mostra tudo quando cabe", () => {
    expect(janelaEmVolta(3, 1, 5)).toEqual({ inicio: 0, fim: 3 });
  });

  it("centraliza o escolhido quando a lista é maior que a janela", () => {
    expect(janelaEmVolta(20, 10, 5)).toEqual({ inicio: 8, fim: 13 });
  });

  it("não passa das pontas da lista", () => {
    expect(janelaEmVolta(20, 0, 5)).toEqual({ inicio: 0, fim: 5 });
    expect(janelaEmVolta(20, 19, 5)).toEqual({ inicio: 15, fim: 20 });
  });
});
