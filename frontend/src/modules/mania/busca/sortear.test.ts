import type { MapaDaBusca } from "./api";
import { sortearMapa } from "./sortear";

const mapa = (id: number) => ({ beatmapsetId: id }) as MapaDaBusca;

describe("sortearMapa", () => {
  it("pede uma página sorteada de ranked com as teclas do filtro e sorteia um mapa novo dela", async () => {
    const buscar = vi.fn(async () => ({ mapas: [mapa(1), mapa(2), mapa(3)], temMais: true }));
    const valores = [0.35, 0.99];
    const sorteado = await sortearMapa(7, { buscar, baixados: new Set([1]), aleatorio: () => valores.shift()! });
    expect(buscar).toHaveBeenCalledWith({ texto: "", status: "ranked", teclas: [7], pagina: 3 });
    expect(sorteado.beatmapsetId).toBe(3);
  });

  it("página vazia volta para a primeira", async () => {
    const buscar = vi.fn(async ({ pagina }: { pagina?: number }) => ({ mapas: pagina ? [] : [mapa(5)], temMais: false }));
    const sorteado = await sortearMapa("todas", { buscar, baixados: new Set(), aleatorio: () => 0.5 });
    expect(buscar).toHaveBeenLastCalledWith({ texto: "", status: "ranked", teclas: [], pagina: 0 });
    expect(sorteado.beatmapsetId).toBe(5);
  });

  it("sem nenhum mapa novo, avisa", async () => {
    const buscar = async () => ({ mapas: [mapa(1)], temMais: false });
    await expect(sortearMapa("todas", { buscar, baixados: new Set([1]), aleatorio: () => 0 })).rejects.toThrow("Nenhum mapa novo");
  });
});
