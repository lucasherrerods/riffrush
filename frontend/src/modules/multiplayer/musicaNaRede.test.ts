import { MUSICAS_EMBUTIDAS, type Musica } from "@/modules/rock/songs";
import { baixarSng } from "@/modules/rock/search";
import { paraRede, resolverMusica } from "./musicaNaRede";

vi.mock("@/modules/rock/search", () => ({ baixarSng: vi.fn() }));
beforeEach(() => vi.mocked(baixarSng).mockClear());

const importada: Musica = {
  ...MUSICAS_EMBUTIDAS[0],
  id: "arquivo:hit.wav:10",
  titulo: "Hit",
  artista: "Banda",
  arquivo: new File(["x"], "hit.wav"),
};

describe("paraRede", () => {
  it("manda só o id das músicas embutidas", () => {
    expect(paraRede(MUSICAS_EMBUTIDAS[0])).toEqual({ tipo: "embutida", id: "spektrem-shine" });
  });

  it("manda título, artista e nome do arquivo das importadas", () => {
    expect(paraRede(importada)).toEqual({ tipo: "importada", id: importada.id, titulo: "Hit", artista: "Banda", nomeDoArquivo: "hit.wav" });
  });
});

describe("resolverMusica", () => {
  it("acha a embutida no catálogo", async () => {
    expect(await resolverMusica({ tipo: "embutida", id: "spektrem-shine" }, [], "http://host")).toBe(MUSICAS_EMBUTIDAS[0]);
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

  it("quem baixa do host a música do Encore fica com o md5, para a partida valer XP", async () => {
    const baixar = vi.fn(async () => new Response(new Blob(["abc"], { type: "audio/wav" })));
    const musica = await resolverMusica(paraRede({ ...importada, id: "arquivo:encore.sng:5", md5DoEncore: "abc123" }), [], "http://h", baixar);
    expect(musica.md5DoEncore).toBe("abc123");
  });

  it("avisa só quando baixou, para a música entrar no catálogo", async () => {
    const baixar = vi.fn(async () => new Response(new Blob(["abc"], { type: "audio/wav" })));
    const aoBaixar = vi.fn();
    const musica = await resolverMusica({ ...paraRede(importada), id: "arquivo:nova.wav:7" }, [], "http://h", baixar, aoBaixar);
    expect(aoBaixar).toHaveBeenCalledWith(musica);
    await resolverMusica(paraRede(importada), [importada], "http://h", baixar, aoBaixar);
    await resolverMusica({ tipo: "embutida", id: "spektrem-shine" }, [], "http://h", baixar, aoBaixar);
    expect(aoBaixar).toHaveBeenCalledTimes(1);
  });

  it("avisa quando o host ainda não compartilhou a música", async () => {
    const baixar = vi.fn(async () => new Response("", { status: 404 }));
    await expect(resolverMusica({ ...paraRede(importada), id: "outra" } as never, [], "http://h", baixar)).rejects.toThrow(/ainda não compartilhou/);
  });

  describe("online", () => {
    const doEncore: Musica = { ...importada, id: "arquivo:Banda - Hit.sng:99", arquivo: new File(["x"], "Banda - Hit.sng"), urlDoEncore: "https://files.enchor.us/abc.sng", md5DoEncore: "abc123" };

    it("a música do Encore vai pela URL, para cada um baixar direto", () => {
      expect(paraRede(doEncore, { online: true })).toEqual({ tipo: "encore", id: doEncore.id, titulo: "Hit", artista: "Banda", nomeDoArquivo: "Banda - Hit.sng", url: "https://files.enchor.us/abc.sng", md5DoEncore: "abc123" });
    });

    it("na LAN a mesma música continua indo pelo host", () => {
      expect(paraRede(doEncore).tipo).toBe("importada");
    });

    it("quem não tem a música baixa do Encore", async () => {
      vi.mocked(baixarSng).mockResolvedValueOnce(new File(["x"], "Banda - Hit.wav", { type: "audio/wav" }));
      const musica = await resolverMusica(paraRede(doEncore, { online: true }), [], "");
      expect(baixarSng).toHaveBeenCalledWith("https://files.enchor.us/abc.sng", "Banda - Hit.sng", expect.anything());
      expect(musica).toMatchObject({ id: doEncore.id, titulo: "Hit", urlDoEncore: "https://files.enchor.us/abc.sng", md5DoEncore: "abc123" });
    });

    it("quem já baixou a mesma música usa a dela", async () => {
      const musica = await resolverMusica(paraRede(doEncore, { online: true }), [doEncore], "");
      expect(musica).toBe(doEncore);
      expect(baixarSng).not.toHaveBeenCalled();
    });
  });
});
