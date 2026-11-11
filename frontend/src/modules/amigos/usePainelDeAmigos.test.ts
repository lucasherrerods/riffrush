import { act, renderHook } from "@testing-library/react";
import { usePainelDeAmigos } from "./usePainelDeAmigos";

describe("usePainelDeAmigos", () => {
  it("começa fechado e alterna", () => {
    const { result } = renderHook(() => usePainelDeAmigos("menu"));
    expect(result.current.aberto).toBe(false);
    act(() => result.current.alternar());
    expect(result.current.aberto).toBe(true);
    act(() => result.current.alternar());
    expect(result.current.aberto).toBe(false);
  });

  it("fecha quando a tela muda", () => {
    const { result, rerender } = renderHook(({ tela }) => usePainelDeAmigos(tela), { initialProps: { tela: "menu" } });
    act(() => result.current.alternar());
    rerender({ tela: "busca" });
    expect(result.current.aberto).toBe(false);
  });

  it("continua aberto enquanto a tela é a mesma", () => {
    const { result, rerender } = renderHook(({ tela }) => usePainelDeAmigos(tela), { initialProps: { tela: "menu" } });
    act(() => result.current.alternar());
    rerender({ tela: "menu" });
    expect(result.current.aberto).toBe(true);
  });
});
