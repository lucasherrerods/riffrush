// @vitest-environment node
// O Blob do jsdom não sobrevive ao structuredClone do IndexedDB; o do Node se comporta como o do navegador.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { MUSICAS_EMBUTIDAS, type Musica } from "@/modules/rock/songs";
import { abrirBibliotecaDoNavegador } from "./bibliotecaDoNavegador";

let agora = 0;
const abrir = () => abrirBibliotecaDoNavegador({ relogio: () => ++agora });

function importada(nome: string, conteudo = "audio"): Musica {
  const arquivo = new File([conteudo], `${nome}.mp3`, { type: "audio/mpeg" });
  return { ...MUSICAS_EMBUTIDAS[0], id: `arquivo:${nome}`, titulo: nome, arquivo };
}

const titulos = (musicas: Musica[]) => musicas.map((m) => m.titulo);
const comAudio = (musicas: Musica[]) => musicas.filter((m) => m.arquivo).map((m) => m.titulo);

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:capa") }));
  agora = 0;
});
afterEach(() => vi.unstubAllGlobals());

describe("abrirBibliotecaDoNavegador", () => {
  it("guarda a música com o arquivo e devolve depois de abrir de novo", async () => {
    await (await abrir()).guardar(importada("Riff", "bytes do riff"));
    const [musica] = await (await abrir()).listar();
    expect(musica).toMatchObject({ id: "arquivo:Riff", titulo: "Riff" });
    expect(musica.arquivo?.name).toBe("Riff.mp3");
    expect(await musica.arquivo?.text()).toBe("bytes do riff");
  });

  it("lista da usada por último para a mais antiga", async () => {
    const biblioteca = await abrir();
    for (const nome of ["a", "b", "c"]) await biblioteca.guardar(importada(nome));
    expect(titulos(await biblioteca.listar())).toEqual(["c", "b", "a"]);
  });

  it("guarda o áudio de todas as músicas, sem limite", async () => {
    const biblioteca = await abrir();
    const nomes = ["a", "b", "c", "d", "e", "f"];
    for (const nome of nomes) await biblioteca.guardar(importada(nome));
    expect(comAudio(await biblioteca.listar())).toEqual([...nomes].reverse());
  });

  it("tocar uma música leva ela para o começo da lista", async () => {
    const biblioteca = await abrir();
    for (const nome of ["a", "b", "c"]) await biblioteca.guardar(importada(nome));
    await biblioteca.usar("arquivo:a");
    expect(titulos(await biblioteca.listar())).toEqual(["a", "c", "b"]);
  });

  it("guarda a capa junto com a música", async () => {
    const biblioteca = await abrir();
    await biblioteca.guardar(importada("a"), new Blob(["png"], { type: "image/png" }));
    expect((await biblioteca.listar())[0].imagemDeCapa).toBe("blob:capa");
  });

  it("pede ao navegador para não apagar as músicas quando faltar espaço", async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal("navigator", { storage: { persist } });
    await abrir();
    expect(persist).toHaveBeenCalled();
  });

  it("não guarda música sem arquivo, como as embutidas", async () => {
    const biblioteca = await abrir();
    await biblioteca.guardar(MUSICAS_EMBUTIDAS[0]);
    expect(await biblioteca.listar()).toEqual([]);
  });

  it("abre o arquivo guardado de uma música", async () => {
    const biblioteca = await abrir();
    await biblioteca.guardar(importada("a", "bytes"));
    expect(await (await biblioteca.abrir("arquivo:a"))?.text()).toBe("bytes");
    expect(await biblioteca.abrir("arquivo:nada")).toBeUndefined();
  });

  it("remover apaga a música do histórico e o áudio", async () => {
    const biblioteca = await abrir();
    await biblioteca.guardar(importada("a"));
    await biblioteca.remover("arquivo:a");
    expect(await biblioteca.listar()).toEqual([]);
  });
});
