import { act, renderHook } from "@testing-library/react";
import { CHAVE_DO_MODO, carregarModo, trocarModo, useModo } from "./modo";

beforeEach(() => localStorage.clear());

describe("carregarModo", () => {
  it("começa no Rock na primeira abertura", () => {
    expect(carregarModo()).toBe("rock");
  });

  it("lembra o modo salvo", () => {
    localStorage.setItem(CHAVE_DO_MODO, "mania");
    expect(carregarModo()).toBe("mania");
  });

  it("volta para o Rock se o modo salvo é desconhecido", () => {
    localStorage.setItem(CHAVE_DO_MODO, "taiko");
    expect(carregarModo()).toBe("rock");
  });
});

describe("trocarModo", () => {
  it("troca, salva e avisa quem usa o modo", () => {
    const { result } = renderHook(() => useModo());
    act(() => trocarModo("mania"));
    expect(result.current).toBe("mania");
    expect(localStorage.getItem(CHAVE_DO_MODO)).toBe("mania");
    act(() => trocarModo("rock"));
    expect(result.current).toBe("rock");
  });
});
