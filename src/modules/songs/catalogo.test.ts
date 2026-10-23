import { MUSICAS_EMBUTIDAS } from "./catalogo";

describe("MUSICAS_EMBUTIDAS", () => {
  it("a única música padrão é Shine, do Spektrem", () => {
    expect(MUSICAS_EMBUTIDAS).toHaveLength(1);
    expect(MUSICAS_EMBUTIDAS[0]).toMatchObject({ id: "spektrem-shine", titulo: "Shine", artista: "Spektrem" });
  });

  it("o áudio vem do arquivo que está no projeto", () => {
    expect(MUSICAS_EMBUTIDAS[0].audioEmbutido).toMatch(/spektrem-shine.*\.mp3/);
  });
});
