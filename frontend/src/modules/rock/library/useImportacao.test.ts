import { act, renderHook } from "@testing-library/react";
import type { Musica } from "@/modules/rock/songs";
import { useImportacao } from "./useImportacao";

vi.mock("@/modules/rock/songs", async (original) => ({
  ...(await original<typeof import("@/modules/rock/songs")>()),
  importarArquivo: vi.fn(async (arquivo: File) => ({ id: arquivo.name, titulo: arquivo.name, sng: true }) as unknown as Musica),
}));
vi.mock("@/shared/ui/avisos", () => ({ avisar: { success: vi.fn(), error: vi.fn() } }));

describe("useImportacao", () => {
  it("devolve as músicas importadas, com o extra, para quem precisa delas na hora", async () => {
    const aoImportar = vi.fn();
    const { result } = renderHook(() => useImportacao(aoImportar));
    let importadas: Musica[] = [];
    await act(async () => {
      importadas = await result.current.importar([new File(["x"], "chart.sng")], { md5DoEncore: "abc" });
    });
    expect(importadas).toEqual([expect.objectContaining({ id: "chart.sng", md5DoEncore: "abc" })]);
    expect(aoImportar).toHaveBeenCalledWith(importadas);
  });

  it("sem nada importável, devolve uma lista vazia", async () => {
    const { result } = renderHook(() => useImportacao(vi.fn()));
    let importadas: Musica[] | undefined;
    await act(async () => {
      importadas = await result.current.importar([new File(["x"], "foto.png")]);
    });
    expect(importadas).toEqual([]);
  });
});
