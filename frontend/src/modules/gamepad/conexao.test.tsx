import { act, renderHook } from "@testing-library/react";
import { useControleConectado } from "./conexao";

afterEach(() => vi.unstubAllGlobals());

describe("useControleConectado", () => {
  it("acompanha o controle conectando e desconectando", () => {
    let controles: unknown[] = [null];
    vi.stubGlobal("navigator", { ...navigator, getGamepads: () => controles });
    const { result } = renderHook(() => useControleConectado());
    expect(result.current).toBe(false);

    controles = [{ buttons: [] }];
    act(() => void window.dispatchEvent(new Event("gamepadconnected")));
    expect(result.current).toBe(true);

    controles = [null];
    act(() => void window.dispatchEvent(new Event("gamepaddisconnected")));
    expect(result.current).toBe(false);
  });
});
