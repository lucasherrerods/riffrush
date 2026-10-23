import { ehImportavel, resumirProgresso } from "./importacao";

describe("ehImportavel", () => {
  it("aceita áudio, vídeo e .sng", () => {
    expect(ehImportavel(new File([], "a.mp3", { type: "audio/mpeg" }))).toBe(true);
    expect(ehImportavel(new File([], "clipe.mp4", { type: "video/mp4" }))).toBe(true);
    expect(ehImportavel(new File([], "musica.sng"))).toBe(true);
    // Arrastado do Windows, às vezes o arquivo chega sem tipo: vale a extensão.
    expect(ehImportavel(new File([], "faixa.ogg"))).toBe(true);
  });

  it("recusa o que não é música", () => {
    expect(ehImportavel(new File([], "foto.png", { type: "image/png" }))).toBe(false);
    expect(ehImportavel(new File([], "notas.txt", { type: "text/plain" }))).toBe(false);
  });
});

describe("resumirProgresso", () => {
  it("junta o progresso de cada arquivo numa fração só e diz qual está sendo lido", () => {
    expect(resumirProgresso(["a.sng", "b.sng", "c.wav"], [1, 0.5, 0])).toEqual({ fracao: 0.5, concluidos: 1, total: 3, atual: "b.sng" });
  });

  it("no fim, o atual é o último arquivo", () => {
    expect(resumirProgresso(["a.sng", "b.sng"], [1, 1])).toEqual({ fracao: 1, concluidos: 2, total: 2, atual: "b.sng" });
  });
});
