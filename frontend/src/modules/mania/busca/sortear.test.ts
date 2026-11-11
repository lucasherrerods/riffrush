import type { DificuldadeDaBusca, MapaDaBusca } from "./api";
import { sortearMapa } from "./sortear";

const dif = (teclas: number, estrelas: number) => ({ teclas, estrelas }) as DificuldadeDaBusca;
const mapa = (id: number, dificuldades = [dif(4, 3)]) => ({ beatmapsetId: id, dificuldades }) as MapaDaBusca;
const semFiltro = { teclas: [], faixas: [] };

describe("sortearMapa", () => {
  it("pede uma página sorteada de ranked com as teclas do filtro e sorteia um mapa novo dela", async () => {
    const buscar = vi.fn(async () => ({ mapas: [mapa(1), mapa(2), mapa(3)], temMais: true }));
    const valores = [0.35, 0.99];
    const sorteado = await sortearMapa({ teclas: [4, 7], faixas: [] }, { buscar, baixados: new Set([1]), aleatorio: () => valores.shift()! });
    expect(buscar).toHaveBeenCalledWith({ texto: "", status: "ranked", teclas: [4, 7], pagina: 3 });
    expect(sorteado.beatmapsetId).toBe(3);
  });

  it("só sorteia mapas com uma dificuldade que tenha as teclas e a faixa pedidas ao mesmo tempo", async () => {
    const mapas = [mapa(1, [dif(4, 5), dif(7, 1)]), mapa(2, [dif(7, 5)]), mapa(3, [dif(4, 1)])];
    const buscar = vi.fn(async () => ({ mapas, temMais: false }));
    const sorteado = await sortearMapa({ teclas: [7], faixas: ["Insane"] }, { buscar, baixados: new Set(), aleatorio: () => 0 });
    expect(sorteado.beatmapsetId).toBe(2);
  });

  it("página vazia volta para a primeira", async () => {
    const buscar = vi.fn(async ({ pagina }: { pagina?: number }) => ({ mapas: pagina ? [] : [mapa(5)], temMais: false }));
    const sorteado = await sortearMapa(semFiltro, { buscar, baixados: new Set(), aleatorio: () => 0.5 });
    expect(buscar).toHaveBeenLastCalledWith({ texto: "", status: "ranked", teclas: [], pagina: 0 });
    expect(sorteado.beatmapsetId).toBe(5);
  });

  it("sem nenhum mapa novo, avisa", async () => {
    const buscar = async () => ({ mapas: [mapa(1)], temMais: false });
    await expect(sortearMapa(semFiltro, { buscar, baixados: new Set([1]), aleatorio: () => 0 })).rejects.toThrow("Nenhum mapa novo");
  });
});
