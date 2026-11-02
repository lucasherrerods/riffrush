import { secaoDoEvento } from "./secoes";

describe("secaoDoEvento", () => {
  it.each([
    ["section Intro", "Intro"],
    ["[section Riff 1]", "Riff 1"],
    ["section intro_a", "Intro A"],
    ["[prc_verse_1]", "Verso 1"],
    ["[prc_chorus_2a]", "Refrão 2a"],
    ["[prc_gtr_solo]", "Solo de guitarra"],
    ["[section bridge]", "Ponte"],
    ["[section pre_chorus_1]", "Pré-refrão 1"],
    ["[section Outro Riff]", "Outro Riff"],
  ])("%s vira %s", (texto, nome) => {
    expect(secaoDoEvento(texto)).toBe(nome);
  });

  it.each(["[music_start]", "[end]", "[lighting (chase)]", "phrase_start", "[section ]"])("%s não é seção", (texto) => {
    expect(secaoDoEvento(texto)).toBeNull();
  });
});
