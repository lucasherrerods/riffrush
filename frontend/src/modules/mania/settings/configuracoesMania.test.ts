import { CONFIGURACOES_PADRAO_DO_MANIA, carregarConfiguracoesDoMania, normalizarConfiguracoes, salvarConfiguracoesDoMania, trocarTecla } from "./configuracoesMania";

beforeEach(() => localStorage.clear());

it("sem nada salvo, usa o padrão", () => {
  expect(carregarConfiguracoesDoMania()).toEqual(CONFIGURACOES_PADRAO_DO_MANIA);
});

it("salva e lê de volta", () => {
  const opcoes = { rolagemMs: 450, atrasoMs: -20, teclasPersonalizadas: { 4: ["KeyA", "KeyS", "KeyK", "KeyL"] } };
  salvarConfiguracoesDoMania(opcoes);
  expect(carregarConfiguracoesDoMania()).toEqual(opcoes);
});

it("valor fora da faixa, quebrado ou teclas inválidas voltam ao padrão", () => {
  expect(
    normalizarConfiguracoes({
      rolagemMs: 99999,
      atrasoMs: Number.NaN,
      teclasPersonalizadas: { 4: ["KeyA", "KeyA", "KeyK", "KeyL"], 5: ["KeyA"], 7: ["KeyS", "KeyD", "KeyF", "Space", "KeyJ", "KeyK", "KeyL"] },
    }),
  ).toEqual({ rolagemMs: 2000, atrasoMs: 0, teclasPersonalizadas: { 7: ["KeyS", "KeyD", "KeyF", "Space", "KeyJ", "KeyK", "KeyL"] } });
  localStorage.setItem("riffrush.mania.configuracoes", "{quebrado");
  expect(carregarConfiguracoesDoMania()).toEqual(CONFIGURACOES_PADRAO_DO_MANIA);
});

it("não guarda volume: o áudio é global, o mesmo do Rock", () => {
  localStorage.setItem("riffrush.mania.configuracoes", JSON.stringify({ volumeDaMusica: 0.1 }));
  expect(carregarConfiguracoesDoMania()).not.toHaveProperty("volumeDaMusica");
});

it("trocar uma tecla que já era de outra coluna troca as duas de lugar", () => {
  expect(trocarTecla(["KeyD", "KeyF", "KeyJ", "KeyK"], 0, "KeyQ")).toEqual(["KeyQ", "KeyF", "KeyJ", "KeyK"]);
  expect(trocarTecla(["KeyD", "KeyF", "KeyJ", "KeyK"], 0, "KeyK")).toEqual(["KeyK", "KeyF", "KeyJ", "KeyD"]);
});
