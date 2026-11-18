import { act, render, screen } from "@testing-library/react";
import { ContagemDaLargada, numeroDaLargada } from "./ContagemDaLargada";

describe("numeroDaLargada", () => {
  it("só os últimos três segundos antes da música viram número", () => {
    expect(numeroDaLargada(10_000, 5_000)).toBe(0);
    expect(numeroDaLargada(10_000, 7_500)).toBe(3);
    expect(numeroDaLargada(10_000, 9_200)).toBe(1);
    expect(numeroDaLargada(10_000, 10_100)).toBe(0);
  });
});

describe("ContagemDaLargada", () => {
  it("mostra o número grande conforme o tempo passa e some na largada", () => {
    vi.useFakeTimers();
    const agora = vi.spyOn(performance, "now").mockReturnValue(7_500);
    render(<ContagemDaLargada inicio={10_000} volume={0} />);
    expect(screen.getByRole("timer", { name: "Começa em 3" })).toBeInTheDocument();
    agora.mockReturnValue(10_100);
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole("timer")).toBeNull();
    agora.mockRestore();
    vi.useRealTimers();
  });
});
