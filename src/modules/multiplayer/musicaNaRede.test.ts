import { MUSICAS_EMBUTIDAS, type Musica } from "@/modules/songs";
import { paraRede, resolverMusica } from "./musicaNaRede";

const importada: Musica = {
  ...MUSICAS_EMBUTIDAS[0],
  id: "arquivo:hit.wav:10",
  titulo: "Hit",
  artista: "Banda",
  arquivo: new File(["x"], "hit.wav"),
};

describe("paraRede", () => {
  it("manda só o id das músicas embutidas", () => {
    expect(paraRede(MUSICAS_EMBUTIDAS[2])).toEqual({ tipo: "embutida", id: "cosmic-riff" });
  });

  it("manda título, artista e nome do arquivo das importadas", () => {
    expect(paraRede(importada)).toEqual({ tipo: "importada", id: importada.id, titulo: "Hit", artista: "Banda", nomeDoArquivo: "hit.wav" });
  });
});

describe("resolverMusica", () => {
  it("acha a embutida no catálogo", async () => {
    expect(await resolverMusica({ tipo: "embutida", id: "overdrive" }, [], "http://host")).toBe(MUSICAS_EMBUTIDAS[3]);
  });

  it("usa a música local quando já tem o arquivo (é o host)", async () => {
    expect(await resolverMusica(paraRede(importada), [importada], "http://host")).toBe(importada);
  });

  it("baixa do host a música importada que não tem", async () => {
    const baixar = vi.fn(async () => new Response(new Blob(["abc"], { type: "audio/wav" })));
    const musica = await resolverMusica(paraRede(importada), [], "http://192.168.0.5:7777", baixar);
    expect(baixar).toHaveBeenCalledWith("http://192.168.0.5:7777/musica");
    expect(musica).toMatchObject({ id: importada.id, titulo: "Hit", artista: "Banda" });
    expect(musica.arquivo?.name).toBe("hit.wav");
  });

  it("avisa quando o host ainda não compartilhou a música", async () => {
    const baixar = vi.fn(async () => new Response("", { status: 404 }));
    await expect(resolverMusica({ ...paraRede(importada), id: "outra" } as never, [], "http://h", baixar)).rejects.toThrow(/ainda não compartilhou/);
  });
});
