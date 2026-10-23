import { act, renderHook } from "@testing-library/react";
import { useValorAtrasado } from "./useValorAtrasado";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useValorAtrasado", () => {
  it("só entrega o valor novo depois que ele para de mudar pelo tempo pedido", () => {
    const { result, rerender } = renderHook(({ valor }) => useValorAtrasado(valor, 500), { initialProps: { valor: "a" } });
    rerender({ valor: "ab" });
    act(() => vi.advanceTimersByTime(300));
    rerender({ valor: "abc" });
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("abc");
  });
});
