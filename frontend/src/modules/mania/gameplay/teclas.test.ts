import { colunaDaTecla, teclasDoMapa } from "./teclas";

describe("teclasDoMapa", () => {
  it("tem um layout padrão para cada número de teclas, de 1 a 18, sem tecla repetida", () => {
    for (let k = 1; k <= 18; k++) {
      const teclas = teclasDoMapa(k);
      expect(teclas).toHaveLength(k);
      expect(new Set(teclas).size).toBe(k);
    }
  });

  it("usa os layouts de costume: 4K em D F J K e 7K com o espaço no meio", () => {
    expect(teclasDoMapa(4)).toEqual(["KeyD", "KeyF", "KeyJ", "KeyK"]);
    expect(teclasDoMapa(7)).toEqual(["KeyS", "KeyD", "KeyF", "Space", "KeyJ", "KeyK", "KeyL"]);
  });

  it("usa as teclas personalizadas do jogador quando o número bate", () => {
    const personalizadas = { 4: ["KeyA", "KeyS", "KeyK", "KeyL"] };
    expect(teclasDoMapa(4, personalizadas)).toEqual(["KeyA", "KeyS", "KeyK", "KeyL"]);
    expect(teclasDoMapa(5, personalizadas)).toEqual(teclasDoMapa(5));
    expect(teclasDoMapa(4, { 4: ["KeyA"] })).toEqual(teclasDoMapa(4));
  });
});

it("colunaDaTecla acha a coluna, ou -1", () => {
  const teclas = teclasDoMapa(4);
  expect(colunaDaTecla(teclas, "KeyJ")).toBe(2);
  expect(colunaDaTecla(teclas, "KeyZ")).toBe(-1);
});
