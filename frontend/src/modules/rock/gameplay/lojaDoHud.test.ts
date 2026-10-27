import { criarLojaDoHud } from "./lojaDoHud";

describe("criarLojaDoHud", () => {
  it("começa com o estado inicial", () => {
    expect(criarLojaDoHud({ pontos: 0 }).ler()).toEqual({ pontos: 0 });
  });

  it("só avisa os inscritos quando algum valor mudou", () => {
    const loja = criarLojaDoHud({ pontos: 0, sequencia: 0 });
    const ouvinte = vi.fn();
    loja.inscrever(ouvinte);
    loja.definir({ pontos: 0, sequencia: 0 });
    expect(ouvinte).not.toHaveBeenCalled();
    loja.definir({ pontos: 10, sequencia: 0 });
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(loja.ler()).toEqual({ pontos: 10, sequencia: 0 });
  });

  it("para de avisar quem saiu", () => {
    const loja = criarLojaDoHud({ pontos: 0 });
    const ouvinte = vi.fn();
    loja.inscrever(ouvinte)();
    loja.definir({ pontos: 1 });
    expect(ouvinte).not.toHaveBeenCalled();
  });
});
