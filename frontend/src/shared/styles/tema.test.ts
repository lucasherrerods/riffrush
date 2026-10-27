import { act, renderHook } from "@testing-library/react";
import { TEMAS, TEMA_PADRAO } from "./temas";
import { definirTema, lerTema, useTema } from "./tema";

afterEach(() => definirTema(TEMA_PADRAO));

it("começa no tema padrão", () => {
  expect(lerTema()).toBe(TEMA_PADRAO);
});

it("trocar o tema publica as cores novas na raiz, sem recarregar", () => {
  definirTema(TEMAS.synthwave);
  expect(document.documentElement.style.getPropertyValue("--cor-primaria")).toBe(TEMAS.synthwave.cores.primaria);
  definirTema(TEMA_PADRAO);
  expect(document.documentElement.style.getPropertyValue("--cor-primaria")).toBe(TEMA_PADRAO.cores.primaria);
});

it("avisa quem usa o tema", () => {
  const { result } = renderHook(() => useTema());
  expect(result.current).toBe(TEMA_PADRAO);
  act(() => definirTema(TEMAS.crimsonNoir));
  expect(result.current).toBe(TEMAS.crimsonNoir);
});

it("marca o esquema de cores na raiz, para o navegador pintar barras e campos certos", () => {
  definirTema(TEMA_PADRAO);
  expect(document.documentElement.style.colorScheme).toBe("dark");
});
