import { act, renderHook } from "@testing-library/react";
import { CHAVE_DO_MODO, carregarModo, modosDisponiveis, trocarModo, useModo } from "./modo";

beforeEach(() => localStorage.clear());

describe("modosDisponiveis", () => {
  it("só o Rock enquanto o Mania está desligado", () => {
    expect(modosDisponiveis(false)).toEqual(["rock"]);
    expect(modosDisponiveis(true)).toEqual(["rock", "mania"]);
  });
});

describe("carregarModo", () => {
  it("começa no Rock na primeira abertura", () => {
    expect(carregarModo(true)).toBe("rock");
  });

  it("lembra o modo salvo", () => {
    localStorage.setItem(CHAVE_DO_MODO, "mania");
    expect(carregarModo(true)).toBe("mania");
  });

  it("volta para o Rock se o modo salvo não está disponível ou é desconhecido", () => {
    localStorage.setItem(CHAVE_DO_MODO, "mania");
    expect(carregarModo(false)).toBe("rock");
    localStorage.setItem(CHAVE_DO_MODO, "taiko");
    expect(carregarModo(true)).toBe("rock");
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
