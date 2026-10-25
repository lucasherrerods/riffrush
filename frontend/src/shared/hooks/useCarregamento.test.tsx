import { act, renderHook, waitFor } from "@testing-library/react";
import { useCarregamento } from "./useCarregamento";

describe("useCarregamento", () => {
  it("começa carregando e fica pronto com o dado", async () => {
    const { result } = renderHook(() => useCarregamento(async () => 42));
    expect(result.current.estado).toEqual({ tipo: "carregando" });
    await waitFor(() => expect(result.current.estado).toEqual({ tipo: "pronto", dado: 42 }));
  });

  it("falha vira erro, e tentar de novo pede outra vez", async () => {
    const carregar = vi.fn().mockRejectedValueOnce(new Error("fora do ar")).mockResolvedValueOnce("ok");
    const { result } = renderHook(() => useCarregamento(carregar));
    await waitFor(() => expect(result.current.estado).toEqual({ tipo: "erro" }));

    act(() => result.current.tentarDeNovo());

    await waitFor(() => expect(result.current.estado).toEqual({ tipo: "pronto", dado: "ok" }));
    expect(carregar).toHaveBeenCalledTimes(2);
  });

  it("trocar a chave pede de novo e cancela o pedido anterior", async () => {
    const sinais: AbortSignal[] = [];
    const carregar = vi.fn((sinal: AbortSignal) => {
      sinais.push(sinal);
      return new Promise<string>(() => {});
    });
    const { rerender } = renderHook(({ chave }) => useCarregamento(carregar, chave), { initialProps: { chave: "a" } });

    rerender({ chave: "b" });

    expect(carregar).toHaveBeenCalledTimes(2);
    expect(sinais[0].aborted).toBe(true);
  });
});
