import { act, renderHook } from "@testing-library/react";
import { LARGURA_DO_CELULAR, useTelaEstreita } from "./useTelaEstreita";

const larguraDaJanela = (largura: number) => {
  Object.defineProperty(window, "innerWidth", { value: largura, configurable: true });
  window.dispatchEvent(new Event("resize"));
};

afterEach(() => larguraDaJanela(1024));

describe("useTelaEstreita", () => {
  it("é estreita abaixo da largura de celular", () => {
    larguraDaJanela(375);
    expect(renderHook(() => useTelaEstreita()).result.current).toBe(true);
  });

  it("não é estreita no desktop", () => {
    larguraDaJanela(LARGURA_DO_CELULAR);
    expect(renderHook(() => useTelaEstreita()).result.current).toBe(false);
  });

  it("acompanha quando a janela muda de tamanho (ex.: celular deitado)", () => {
    larguraDaJanela(1024);
    const { result } = renderHook(() => useTelaEstreita());
    act(() => larguraDaJanela(400));
    expect(result.current).toBe(true);
  });
});
