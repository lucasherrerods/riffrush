import type { ConjuntoSalvo } from "../beatmaps/biblioteca";
import type { OszLido } from "../beatmaps/osz";
import { faixasDaBiblioteca } from "./trilhaDoMania";

const conjunto = (id: string, titulo: string) => ({ id, titulo, tituloUnicode: "", artista: "Banda", artistaUnicode: "", mapas: [] }) as unknown as ConjuntoSalvo;

describe("faixasDaBiblioteca", () => {
  it("põe cada conjunto da biblioteca na fila do player, com título e artista", () => {
    const faixas = faixasDaBiblioteca([conjunto("a", "Um"), conjunto("b", "Dois")], async () => undefined);
    expect(faixas.map((f) => [f.id, f.titulo, f.artista])).toEqual([
      ["a", "Um", "Banda"],
      ["b", "Dois", "Banda"],
    ]);
  });

  it("o áudio sai do .osz do conjunto quando a faixa toca", async () => {
    const audio = new Uint8Array([1, 2, 3]);
    const pacote = { mapas: [{ arquivoDeAudio: "audio.mp3" }], arquivos: new Map([["audio.mp3", audio]]) } as unknown as OszLido;
    const abrir = vi.fn(async () => pacote);
    const [faixa] = faixasDaBiblioteca([conjunto("a", "Um")], abrir);
    expect(await faixa.abrirAudio()).toBe(audio);
    expect(abrir).toHaveBeenCalledWith("a");
  });
});
