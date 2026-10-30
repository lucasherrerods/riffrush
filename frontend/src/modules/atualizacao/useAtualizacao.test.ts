import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTERVALO_DE_VERIFICACAO, useAtualizacao, type Buscador } from "./useAtualizacao";

const pronta = (versao = "0.2.0") => ({ versao, instalar: vi.fn(async () => {}) });

describe("useAtualizacao", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("procura ao abrir e de novo a cada hora", async () => {
    const buscar = vi.fn<Buscador>(async () => null);
    renderHook(() => useAtualizacao({ emPartida: false, buscar, avisar: vi.fn() }));
    await act(async () => {});
    expect(buscar).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(INTERVALO_DE_VERIFICACAO));
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("para de procurar depois que uma atualização ficou pronta", async () => {
    const buscar = vi.fn<Buscador>(async () => pronta());
    renderHook(() => useAtualizacao({ emPartida: false, buscar, avisar: vi.fn() }));
    await act(async () => {});
    await act(async () => vi.advanceTimersByTime(INTERVALO_DE_VERIFICACAO * 3));
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("só avisa fora da partida, e uma vez só", async () => {
    const avisar = vi.fn();
    const buscar = vi.fn<Buscador>(async () => pronta());
    const { rerender } = renderHook(({ emPartida }) => useAtualizacao({ emPartida, buscar, avisar }), { initialProps: { emPartida: true } });
    await act(async () => {});
    expect(avisar).not.toHaveBeenCalled();
    rerender({ emPartida: false });
    rerender({ emPartida: true });
    rerender({ emPartida: false });
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(avisar).toHaveBeenCalledWith("0.2.0", expect.any(Function));
  });

  it("o reinício do aviso instala a atualização", async () => {
    const atualizacao = pronta();
    const avisar = vi.fn();
    renderHook(() => useAtualizacao({ emPartida: false, buscar: async () => atualizacao, avisar }));
    await act(async () => {});
    await avisar.mock.calls[0][1]();
    expect(atualizacao.instalar).toHaveBeenCalled();
  });

  it("um erro na busca não derruba o jogo e tenta de novo na hora seguinte", async () => {
    const buscar = vi.fn<Buscador>().mockRejectedValueOnce(new Error("sem rede")).mockResolvedValue(null);
    renderHook(() => useAtualizacao({ emPartida: false, buscar, avisar: vi.fn() }));
    await act(async () => {});
    await act(async () => vi.advanceTimersByTime(INTERVALO_DE_VERIFICACAO));
    expect(buscar).toHaveBeenCalledTimes(2);
  });
});
