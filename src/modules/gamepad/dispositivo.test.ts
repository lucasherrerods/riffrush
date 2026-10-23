import { act, renderHook } from "@testing-library/react";
import { marcarComoDoControle, registrarUso, rotuloDoComando, useDispositivo } from "./dispositivo";

beforeEach(() => registrarUso("teclado"));

describe("useDispositivo", () => {
  it("começa no teclado e passa para o controle quando ele é usado", () => {
    const { result } = renderHook(() => useDispositivo());
    expect(result.current).toBe("teclado");
    act(() => registrarUso("controle"));
    expect(result.current).toBe("controle");
  });

  it("volta para o teclado quando uma tecla de verdade é apertada", () => {
    const { result } = renderHook(() => useDispositivo());
    act(() => registrarUso("controle"));
    act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA" })));
    expect(result.current).toBe("teclado");
  });

  it("as teclas que o próprio controle simula não contam como teclado", () => {
    const { result } = renderHook(() => useDispositivo());
    act(() => registrarUso("controle"));
    const doControle = new KeyboardEvent("keydown", { code: "Enter" });
    marcarComoDoControle(doControle);
    act(() => void window.dispatchEvent(doControle));
    expect(result.current).toBe("controle");
  });
});

describe("rotuloDoComando", () => {
  it("mostra as teclas no teclado e os botões no controle", () => {
    expect(rotuloDoComando("confirmar", "teclado")).toBe("Enter");
    expect(rotuloDoComando("voltar", "teclado")).toBe("Esc");
    expect(rotuloDoComando("confirmar", "controle")).toBe("A");
    expect(rotuloDoComando("voltar", "controle")).toBe("B");
    expect(rotuloDoComando("vertical", "controle")).not.toBe(rotuloDoComando("vertical", "teclado"));
  });
});
