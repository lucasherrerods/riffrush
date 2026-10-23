import { act, renderHook, waitFor } from "@testing-library/react";
import { MUSICAS_EMBUTIDAS, type Musica } from "@/modules/songs";
import type { Biblioteca } from "./storage/biblioteca";
import { useBiblioteca } from "./useBiblioteca";

const salva: Musica = { ...MUSICAS_EMBUTIDAS[0], id: "arquivo:salva", titulo: "Salva" };

function bibliotecaFalsa(): Biblioteca {
  return { listar: vi.fn(async () => [salva]), guardar: vi.fn(async () => {}), usar: vi.fn(async () => {}), remover: vi.fn(async () => {}) };
}

describe("useBiblioteca", () => {
  it("carrega as músicas salvas ao abrir", async () => {
    const biblioteca = bibliotecaFalsa();
    const { result } = renderHook(() => useBiblioteca(async () => biblioteca));
    await waitFor(() => expect(result.current.salvas).toEqual([salva]));
  });

  it("guarda as importadas, com a capa, e marca as tocadas", async () => {
    const biblioteca = bibliotecaFalsa();
    const capa = new Blob(["png"]);
    vi.stubGlobal("fetch", vi.fn(async () => ({ blob: async () => capa })));
    const { result } = renderHook(() => useBiblioteca(async () => biblioteca));
    await waitFor(() => expect(result.current.salvas).toHaveLength(1));

    const comCapa = { ...salva, imagemDeCapa: "blob:capa" };
    await act(() => result.current.guardar([comCapa]));
    expect(biblioteca.guardar).toHaveBeenCalledWith(comCapa, capa);

    await act(() => result.current.usar("arquivo:salva"));
    expect(biblioteca.usar).toHaveBeenCalledWith("arquivo:salva");
    vi.unstubAllGlobals();
  });

  it("sem IndexedDB (aba anônima), o jogo continua sem salvar nada", async () => {
    const { result } = renderHook(() => useBiblioteca(async () => Promise.reject(new Error("sem IndexedDB"))));
    await waitFor(() => expect(result.current.salvas).toEqual([]));
    await expect(act(() => result.current.guardar([salva]))).resolves.not.toThrow();
  });
});
