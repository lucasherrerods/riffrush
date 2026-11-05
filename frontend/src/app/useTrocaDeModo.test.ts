import { act, renderHook } from "@testing-library/react";
import { DURACAO_DO_GIRO_MS } from "@/shared/ui/volvelle/geometria";
import { useTrocaDeModo } from "./useTrocaDeModo";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useTrocaDeModo", () => {
  it("pedir o outro modo monta a capa, troca o modo no quadro seguinte e então gira", () => {
    const trocar = vi.fn();
    const { result } = renderHook(() => useTrocaDeModo("rock", { trocar, preCarregar: vi.fn() }));
    act(() => result.current.pedir("mania"));
    expect(result.current.giro).toEqual({ de: "rock", para: "mania", sentido: 1, fase: "chegando", girou: false });
    expect(trocar).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(40));
    expect(trocar).toHaveBeenCalledWith("mania");
    expect(result.current.giro?.girou).toBe(true);
  });

  it("quando a capa sai da tela, a troca acaba", () => {
    const { result } = renderHook(() => useTrocaDeModo("rock", { trocar: vi.fn(), preCarregar: vi.fn() }));
    act(() => result.current.pedir("mania"));
    act(() => vi.advanceTimersByTime(DURACAO_DO_GIRO_MS + 200));
    expect(result.current.giro).toBeNull();
  });

  it("volta para o Rock girando ao contrário", () => {
    const { result } = renderHook(() => useTrocaDeModo("mania", { trocar: vi.fn(), preCarregar: vi.fn() }));
    act(() => result.current.pedir("rock"));
    expect(result.current.giro?.sentido).toBe(-1);
  });

  it("baixa o modo de destino logo no começo do giro", () => {
    const preCarregar = vi.fn();
    const { result } = renderHook(() => useTrocaDeModo("rock", { trocar: vi.fn(), preCarregar }));
    act(() => result.current.pedir("mania"));
    expect(preCarregar).toHaveBeenCalledWith("mania");
  });

  it("ignora pedidos durante o giro e para o próprio modo", () => {
    const preCarregar = vi.fn();
    const { result } = renderHook(() => useTrocaDeModo("rock", { trocar: vi.fn(), preCarregar }));
    act(() => result.current.pedir("rock"));
    expect(result.current.giro).toBeNull();
    act(() => result.current.pedir("mania"));
    act(() => result.current.pedir("mania"));
    expect(preCarregar).toHaveBeenCalledOnce();
  });

  it("com o movimento reduzido, troca na hora, sem giro", () => {
    const trocar = vi.fn();
    const { result } = renderHook(() => useTrocaDeModo("rock", { trocar, preCarregar: vi.fn(), semMovimento: true }));
    act(() => result.current.pedir("mania"));
    expect(trocar).toHaveBeenCalledWith("mania");
    expect(result.current.giro).toBeNull();
  });
});
