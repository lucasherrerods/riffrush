import { OPCOES_PADRAO_DO_MANIA } from "../gameplay/TelaDeJogoMania";
import { carregarConfiguracoesDoMania, normalizarConfiguracoes, salvarConfiguracoesDoMania, trocarTecla } from "./configuracoesMania";

beforeEach(() => localStorage.clear());

it("sem nada salvo, usa o padrão", () => {
  expect(carregarConfiguracoesDoMania()).toEqual(OPCOES_PADRAO_DO_MANIA);
});

it("salva e lê de volta", () => {
  const opcoes = { rolagemMs: 450, atrasoMs: -20, volumeDaMusica: 0.5, teclasPersonalizadas: { 4: ["KeyA", "KeyS", "KeyK", "KeyL"] } };
  salvarConfiguracoesDoMania(opcoes);
  expect(carregarConfiguracoesDoMania()).toEqual(opcoes);
});

it("valor fora da faixa, quebrado ou teclas inválidas voltam ao padrão", () => {
  expect(
    normalizarConfiguracoes({
      rolagemMs: 99999,
      atrasoMs: Number.NaN,
      volumeDaMusica: -1,
      teclasPersonalizadas: { 4: ["KeyA", "KeyA", "KeyK", "KeyL"], 5: ["KeyA"], 7: ["KeyS", "KeyD", "KeyF", "Space", "KeyJ", "KeyK", "KeyL"] },
    }),
  ).toEqual({ rolagemMs: 2000, atrasoMs: 0, volumeDaMusica: 0, teclasPersonalizadas: { 7: ["KeyS", "KeyD", "KeyF", "Space", "KeyJ", "KeyK", "KeyL"] } });
  localStorage.setItem("riffrush.mania.configuracoes", "{quebrado");
  expect(carregarConfiguracoesDoMania()).toEqual(OPCOES_PADRAO_DO_MANIA);
});

it("trocar uma tecla que já era de outra coluna troca as duas de lugar", () => {
  expect(trocarTecla(["KeyD", "KeyF", "KeyJ", "KeyK"], 0, "KeyQ")).toEqual(["KeyQ", "KeyF", "KeyJ", "KeyK"]);
  expect(trocarTecla(["KeyD", "KeyF", "KeyJ", "KeyK"], 0, "KeyK")).toEqual(["KeyK", "KeyF", "KeyJ", "KeyD"]);
});
