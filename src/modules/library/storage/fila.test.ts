import { LIMITE_DE_BYTES, LIMITE_DE_MUSICAS, quemPerdeOAudio } from "./fila";

const MB = 1024 * 1024;
const item = (id: string, usadaEm: number, tamanho = 10 * MB) => ({ id, usadaEm, tamanho });

describe("quemPerdeOAudio", () => {
  it("guarda o áudio de até 3 músicas", () => {
    expect(LIMITE_DE_MUSICAS).toBe(3);
    expect(quemPerdeOAudio([item("a", 1), item("b", 2), item("c", 3)])).toEqual([]);
  });

  it("a quarta música tira o áudio da usada há mais tempo", () => {
    expect(quemPerdeOAudio([item("a", 1), item("b", 4), item("c", 3), item("d", 2)])).toEqual(["a"]);
  });

  it("as 3 juntas não passam de 150 MB", () => {
    expect(LIMITE_DE_BYTES).toBe(150 * MB);
    expect(quemPerdeOAudio([item("nova", 3, 100 * MB), item("media", 2, 40 * MB), item("velha", 1, 20 * MB)])).toEqual(["velha"]);
  });

  it("uma música maior que o limite não guarda o áudio, e as outras ficam", () => {
    expect(quemPerdeOAudio([item("gigante", 3, 200 * MB), item("b", 2), item("c", 1)])).toEqual(["gigante"]);
  });

  it("sem músicas, ninguém sai", () => {
    expect(quemPerdeOAudio([])).toEqual([]);
  });
});
