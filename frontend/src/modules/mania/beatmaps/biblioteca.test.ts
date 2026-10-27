// @vitest-environment node
// O Blob do jsdom não sobrevive ao structuredClone do IndexedDB; o do Node se comporta como o do navegador.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { osu, pacote } from "@/test/beatmaps";
import { abrirBibliotecaDoMania, importarOsz } from "./biblioteca";

let agora = 0;
const abrir = () => abrirBibliotecaDoMania({ relogio: () => ++agora });
const osz = (beatmapsetId = 7, titulo = "Musica") =>
  new Blob([new Uint8Array(pacote({ "a.osu": osu().replace("BeatmapSetID:7", `BeatmapSetID:${beatmapsetId}`).replace("Title:Musica", `Title:${titulo}`), "audio.mp3": new Uint8Array([9]) }))]);

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  agora = 0;
});
afterEach(() => vi.unstubAllGlobals());

describe("biblioteca do Mania", () => {
  it("importar guarda o conjunto com as dificuldades, sem o texto dos .osu", async () => {
    const biblioteca = await abrir();
    const salvo = await importarOsz(biblioteca, osz(), { origem: "osu", status: "ranked", estrelas: {} });
    expect(salvo).toMatchObject({ id: "osu:7", titulo: "Musica", origem: "osu", status: "ranked" });
    const [lido] = await biblioteca.listar();
    expect(lido.mapas[0]).toMatchObject({ dificuldade: "Hard", teclas: 4, notas: 2 });
    expect(lido.mapas[0]).not.toHaveProperty("texto");
  });

  it("abrir devolve o pacote lido de novo, com áudio e .osu", async () => {
    const biblioteca = await abrir();
    await importarOsz(biblioteca, osz(), { origem: "osu" });
    const pacoteLido = await biblioteca.abrir("osu:7");
    expect(pacoteLido?.mapas[0].texto).toContain("[HitObjects]");
    expect(pacoteLido?.arquivos.get("audio.mp3")).toEqual(new Uint8Array([9]));
    expect(await biblioteca.abrir("osu:999")).toBeUndefined();
  });

  it("lista do usado por último para o mais antigo, e importar de novo substitui", async () => {
    const biblioteca = await abrir();
    await importarOsz(biblioteca, osz(1, "Um"), { origem: "osu" });
    await importarOsz(biblioteca, osz(2, "Dois"), { origem: "osu" });
    await biblioteca.usar("osu:1");
    expect((await biblioteca.listar()).map((c) => c.titulo)).toEqual(["Um", "Dois"]);
    await importarOsz(biblioteca, osz(2, "Dois de novo"), { origem: "osu" });
    expect((await biblioteca.listar()).map((c) => c.titulo)).toEqual(["Dois de novo", "Um"]);
  });

  it("um .osz sem id do osu! fica como importado, pelo hash", async () => {
    const biblioteca = await abrir();
    const salvo = await importarOsz(biblioteca, osz(0), { origem: "importado" });
    expect(salvo.id).toMatch(/^arquivo:[0-9a-f]{32}$/);
    expect(salvo.origem).toBe("importado");
  });

  it("remover apaga o conjunto e o pacote", async () => {
    const biblioteca = await abrir();
    await importarOsz(biblioteca, osz(), { origem: "osu" });
    await biblioteca.remover("osu:7");
    expect(await biblioteca.listar()).toEqual([]);
    expect(await biblioteca.abrir("osu:7")).toBeUndefined();
  });

  it("a biblioteca do Mania não se mistura com a do Rock", async () => {
    const biblioteca = await abrir();
    await importarOsz(biblioteca, osz(), { origem: "osu" });
    const bancos = await indexedDB.databases();
    expect(bancos.map((b) => b.name)).toEqual(["riffrush-mania"]);
  });
});
