import { renderHook } from "@testing-library/react";
import * as efeitos from "./efeitos";
import { useBipDaContagem } from "./useBipDaContagem";

describe("useBipDaContagem", () => {
  it("bipa a cada número e dá o bip agudo da largada quando chega a zero", () => {
    const tocar = vi.spyOn(efeitos, "tocarEfeito").mockImplementation(() => {});
    const { rerender } = renderHook(({ valor }) => useBipDaContagem(valor, 0.5, true), { initialProps: { valor: 4 } });
    expect(tocar).not.toHaveBeenCalled();
    for (const valor of [3, 2, 1, 0]) rerender({ valor });
    expect(tocar.mock.calls.map(([nome]) => nome)).toEqual(["contagem", "contagem", "contagem", "largada"]);
    tocar.mockRestore();
  });

  it("desligado não toca nada", () => {
    const tocar = vi.spyOn(efeitos, "tocarEfeito").mockImplementation(() => {});
    const { rerender } = renderHook(({ valor }) => useBipDaContagem(valor, 0.5, false), { initialProps: { valor: 3 } });
    rerender({ valor: 0 });
    expect(tocar).not.toHaveBeenCalled();
    tocar.mockRestore();
  });
});
