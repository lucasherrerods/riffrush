// @vitest-environment node
// O Blob do jsdom não sobrevive ao structuredClone do IndexedDB; o do Node se comporta como o do navegador.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { osu, pacote } from "@/test/beatmaps";
import { abrirBibliotecaDoMania, beatmapIdParaAApi, fonteDaCapa, importarOsz, type ConjuntoSalvo } from "./biblioteca";

const motor = vi.hoisted(() => ({ iniciado: 0 }));
vi.mock("../gameplay/motor", async (original) => {
  const real = await original<typeof import("../gameplay/motor")>();
  return { ...real, iniciarMotorDoMania: async () => void motor.iniciado++ };
});

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

  it("guarda o fundo do mapa como capa, para a roda não precisar abrir o pacote", async () => {
    const biblioteca = await abrir();
    const comFundo = new Blob([new Uint8Array(pacote({ "a.osu": osu(), "audio.mp3": new Uint8Array([9]), "fundo.jpg": new Uint8Array([1, 2, 3]) }))]);
    await importarOsz(biblioteca, comFundo, { origem: "osu" });
    const [lido] = await biblioteca.listar();
    expect(lido.capa?.type).toBe("image/jpeg");
    expect(new Uint8Array(await lido.capa!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
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

  it("carrega o motor antes de ler o pacote, ao importar e ao abrir", async () => {
    // O .osu é lido pelo WASM do Mania, que no app só carrega quando alguém pede.
    const biblioteca = await abrir();
    motor.iniciado = 0;
    await importarOsz(biblioteca, osz(), { origem: "osu" });
    expect(motor.iniciado).toBe(1);
    await biblioteca.abrir("osu:7");
    expect(motor.iniciado).toBe(2);
  });

  it("a biblioteca do Mania não se mistura com a do Rock", async () => {
    const biblioteca = await abrir();
    await importarOsz(biblioteca, osz(), { origem: "osu" });
    const bancos = await indexedDB.databases();
    expect(bancos.map((b) => b.name)).toEqual(["riffrush-mania"]);
  });
});

it("partida em mapa do osu! vai para a API mesmo fora do ranked; importado e sem id, não", () => {
  const conjunto = (origem: ConjuntoSalvo["origem"], status?: string) => ({ origem, status }) as ConjuntoSalvo;
  expect(beatmapIdParaAApi(conjunto("osu", "graveyard"), 42)).toBe(42);
  expect(beatmapIdParaAApi(conjunto("osu", "ranked"), 42)).toBe(42);
  expect(beatmapIdParaAApi(conjunto("importado"), 42)).toBeUndefined();
  expect(beatmapIdParaAApi(conjunto("osu", "ranked"), 0)).toBeUndefined();
});

describe("fonteDaCapa", () => {
  const base = { id: "osu:7", beatmapsetId: 7, origem: "osu" } as ConjuntoSalvo;
  it("usa o fundo guardado", () => {
    const capa = new Blob([]);
    expect(fonteDaCapa({ ...base, capa })).toBe(capa);
  });
  it("sem fundo guardado, um mapa do osu! usa a capa do site", () => {
    expect(fonteDaCapa(base)).toBe("https://assets.ppy.sh/beatmaps/7/covers/list@2x.jpg");
  });
  it("um importado sem fundo fica sem capa", () => {
    expect(fonteDaCapa({ id: "arquivo:x", origem: "importado" } as ConjuntoSalvo)).toBeUndefined();
  });
});
