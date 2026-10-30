import { act, renderHook } from "@testing-library/react";
import { criarLojaDoHud, useLoja } from "./lojaDoHud";

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

describe("useLoja com seletor", () => {
  it("só re-renderiza quando o pedaço escolhido muda", () => {
    const loja = criarLojaDoHud({ pontos: 0, vida: 1, sequencia: 0 });
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useLoja(loja, (h) => ({ vida: h.vida, sequencia: h.sequencia }));
    });
    const antes = renders;
    act(() => loja.definir({ pontos: 10, vida: 1, sequencia: 0 }));
    expect(renders).toBe(antes);
    act(() => loja.definir({ pontos: 10, vida: 0.5, sequencia: 0 }));
    expect(renders).toBe(antes + 1);
    expect(result.current).toEqual({ vida: 0.5, sequencia: 0 });
  });

  it("aceita um seletor que devolve um valor só", () => {
    const loja = criarLojaDoHud({ pontos: 0, vida: 1 });
    const { result } = renderHook(() => useLoja(loja, (h) => h.pontos));
    act(() => loja.definir({ pontos: 7, vida: 1 }));
    expect(result.current).toBe(7);
  });
});
