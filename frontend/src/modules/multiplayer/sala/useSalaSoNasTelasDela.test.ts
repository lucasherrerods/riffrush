import { renderHook } from "@testing-library/react";
import { useSalaSoNasTelasDela } from "./useSalaSoNasTelasDela";

describe("useSalaSoNasTelasDela", () => {
  it("sai da sala quando a tela atual não é uma das que a mantêm", () => {
    const sair = vi.fn();
    const { rerender } = renderHook(({ mantem }) => useSalaSoNasTelasDela(true, mantem, sair), { initialProps: { mantem: true } });
    expect(sair).not.toHaveBeenCalled();
    rerender({ mantem: false });
    expect(sair).toHaveBeenCalledTimes(1);
  });

  it("fora de uma sala não faz nada", () => {
    const sair = vi.fn();
    renderHook(() => useSalaSoNasTelasDela(false, false, sair));
    expect(sair).not.toHaveBeenCalled();
  });

  it("sai da sala quando o modo inteiro é desmontado, como ao trocar de Rock para Mania", () => {
    const sair = vi.fn();
    const { unmount } = renderHook(() => useSalaSoNasTelasDela(true, true, sair));
    unmount();
    expect(sair).toHaveBeenCalledTimes(1);
  });
});
