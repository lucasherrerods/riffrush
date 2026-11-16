import type { SugestaoDeMusica } from "@/modules/presenca";
import { tirarSugestaoPendente, tocarSugestaoNoModoCerto } from "./tocarSugestao";

const sugestao: SugestaoDeMusica = { modo: "mania", musica: "1234", versao: null, titulo: "Galaxy Collapse", artista: "Kurokotei", dificuldade: "7K" };

it("no modo da música abre aqui", () => {
  const abrir = vi.fn();
  const trocar = vi.fn();
  tocarSugestaoNoModoCerto(sugestao, "mania", abrir, trocar);
  expect(abrir).toHaveBeenCalledWith(sugestao);
  expect(trocar).not.toHaveBeenCalled();
  expect(tirarSugestaoPendente()).toBeNull();
});

it("no outro modo troca e deixa a sugestão para o outro modo abrir, uma vez só", () => {
  const abrir = vi.fn();
  const trocar = vi.fn();
  tocarSugestaoNoModoCerto(sugestao, "rock", abrir, trocar);
  expect(trocar).toHaveBeenCalledWith("mania");
  expect(abrir).not.toHaveBeenCalled();
  expect(tirarSugestaoPendente()).toEqual(sugestao);
  expect(tirarSugestaoPendente()).toBeNull();
});
