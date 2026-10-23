// @vitest-environment node
// O Blob do jsdom não sobrevive ao structuredClone do IndexedDB; o do Node se comporta como o do navegador.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { MUSICAS_EMBUTIDAS, type Musica } from "@/modules/songs";
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

  it("a quarta música tira o áudio da mais antiga, que continua no histórico", async () => {
    const biblioteca = await abrir();
    for (const nome of ["a", "b", "c", "d"]) await biblioteca.guardar(importada(nome));
    const musicas = await biblioteca.listar();
    expect(titulos(musicas)).toEqual(["d", "c", "b", "a"]);
    expect(comAudio(musicas)).toEqual(["d", "c", "b"]);
  });

  it("tocar uma música leva ela para o começo da fila", async () => {
    const biblioteca = await abrir();
    for (const nome of ["a", "b", "c"]) await biblioteca.guardar(importada(nome));
    await biblioteca.usar("arquivo:a");
    await biblioteca.guardar(importada("d"));
    expect(comAudio(await biblioteca.listar())).toEqual(["d", "a", "c"]);
  });

  it("guardar de novo uma música do histórico devolve o áudio a ela", async () => {
    const biblioteca = await abrir();
    for (const nome of ["a", "b", "c", "d"]) await biblioteca.guardar(importada(nome));
    await biblioteca.guardar(importada("a"));
    const musicas = await biblioteca.listar();
    expect(titulos(musicas)).toEqual(["a", "d", "c", "b"]);
    expect(comAudio(musicas)).toEqual(["a", "d", "c"]);
  });

  it("guarda a capa junto com o histórico", async () => {
    const biblioteca = await abrir();
    for (const nome of ["a", "b", "c", "d"]) await biblioteca.guardar(importada(nome), new Blob(["png"], { type: "image/png" }));
    const antiga = (await biblioteca.listar()).at(-1)!;
    expect(antiga.arquivo).toBeUndefined();
    expect(antiga.imagemDeCapa).toBe("blob:capa");
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
