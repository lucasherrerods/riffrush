import { osu, pacote } from "@/test/beatmaps";
import { ErroDoOsz, lerOsz } from "./osz";

describe("lerOsz", () => {
  it("lê as dificuldades mania, o áudio e o fundo", () => {
    const lido = lerOsz(
      pacote({
        "Banda - Musica (Mapper) [Hard].osu": osu(),
        "Banda - Musica (Mapper) [7K Insane].osu": osu({ dificuldade: "7K Insane", teclas: 7, beatmapId: 12 }),
        "audio.mp3": new Uint8Array([1, 2, 3]),
        "fundo.jpg": new Uint8Array([4, 5]),
        "hitsound.wav": new Uint8Array(10),
      }),
    );
    expect(lido.conjunto).toMatchObject({ titulo: "Musica", tituloUnicode: "Música", artista: "Banda", mapper: "Mapper", beatmapsetId: 7 });
    expect(lido.mapas.map((m) => [m.dificuldade, m.teclas, m.beatmapId, m.notas, m.notasLongas])).toEqual([
      ["Hard", 4, 11, 2, 1],
      ["7K Insane", 7, 12, 2, 1],
    ]);
    expect(lido.mapas[0].hash).toMatch(/^[0-9a-f]{32}$/);
    expect(lido.mapas[0].texto).toContain("Version:Hard");
    expect([...lido.arquivos.keys()].sort()).toEqual(["audio.mp3", "fundo.jpg"]);
  });

  it("deixa de fora as dificuldades de outros modos do osu!", () => {
    const lido = lerOsz(pacote({ "a.osu": osu(), "b.osu": osu({ dificuldade: "Taiko", modo: 1 }), "audio.mp3": new Uint8Array(1) }));
    expect(lido.mapas.map((m) => m.dificuldade)).toEqual(["Hard"]);
  });

  it("acha o áudio sem diferenciar maiúsculas, como o osu!", () => {
    const lido = lerOsz(pacote({ "a.osu": osu({ audio: "Audio.MP3" }), "audio.mp3": new Uint8Array(1) }));
    expect([...lido.arquivos.keys()]).toContain("Audio.MP3");
  });

  it("ordena as dificuldades por teclas e depois pelo número de notas", () => {
    const lido = lerOsz(
      pacote({ "a.osu": osu({ teclas: 7, dificuldade: "7K" }), "b.osu": osu({ teclas: 4, dificuldade: "4K" }), "audio.mp3": new Uint8Array(1) }),
    );
    expect(lido.mapas.map((m) => m.dificuldade)).toEqual(["4K", "7K"]);
  });

  it("recusa o que não é um .osz", () => {
    expect(() => lerOsz(new Uint8Array([1, 2, 3]))).toThrow(ErroDoOsz);
  });

  it("recusa um pacote sem nenhuma dificuldade mania", () => {
    expect(() => lerOsz(pacote({ "a.osu": osu({ modo: 0 }), "audio.mp3": new Uint8Array(1) }))).toThrow("Nenhuma dificuldade do modo mania");
  });

  it("recusa um pacote sem o áudio", () => {
    expect(() => lerOsz(pacote({ "a.osu": osu() }))).toThrow("áudio");
  });

  it("recusa arquivos grandes demais antes de descompactar", () => {
    expect(() => lerOsz(pacote({ "a.osu": osu(), "audio.mp3": new Uint8Array(1) }), { maximoPorArquivo: 10 })).toThrow("grande demais");
  });
});
