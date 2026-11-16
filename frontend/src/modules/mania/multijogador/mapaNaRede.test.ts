import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";
import { acharNaBiblioteca, paraRede, podeJogarOnline, resolverMapa, type DependenciasDoMapa } from "./mapaNaRede";

const dificuldade = (hash: string): DificuldadeSalva => ({ hash, dificuldade: "Hard", teclas: 4, od: 8, hp: 8, notas: 10, duracaoMs: 1000 }) as DificuldadeSalva;
const conjunto = (extra: Partial<ConjuntoSalvo> = {}): ConjuntoSalvo => ({
  id: "osu:7",
  origem: "osu",
  beatmapsetId: 7,
  status: "ranked",
  titulo: "Musica",
  tituloUnicode: "",
  artista: "Banda",
  artistaUnicode: "",
  mapper: "x",
  mapas: [dificuldade("h1")],
  usadoEm: 0,
  ...extra,
});

function dependencias(extra: Partial<DependenciasDoMapa> = {}): DependenciasDoMapa {
  return {
    conjuntos: [],
    endereco: "http://192.168.0.5:7777",
    baixarOsz: vi.fn(async () => new Blob(["osz"])),
    guardarDoOsu: vi.fn(async () => conjunto()),
    importar: vi.fn(async () => conjunto({ id: "arquivo:h1", origem: "importado", beatmapsetId: undefined })),
    buscar: vi.fn(async () => new Response(new Blob(["osz"]))),
    ...extra,
  };
}

describe("mapa na rede", () => {
  it("mapa do osu! vai pelo id do conjunto; importado vai pelo arquivo", () => {
    expect(paraRede(conjunto(), dificuldade("h1"))).toEqual({ tipo: "osu", beatmapsetId: 7, hash: "h1", titulo: "Musica", artista: "Banda", dificuldade: "Hard", teclas: 4, status: "ranked" });
    expect(paraRede(conjunto({ origem: "importado", beatmapsetId: undefined }), dificuldade("h1")).tipo).toBe("importado");
  });

  it("no online só vão os mapas do osu!, que cada um baixa sozinho", () => {
    expect(podeJogarOnline(conjunto())).toBe(true);
    expect(podeJogarOnline(conjunto({ origem: "importado" }))).toBe(false);
  });

  it("acha a dificuldade na biblioteca pelo hash", () => {
    expect(acharNaBiblioteca({ ...paraRede(conjunto(), dificuldade("h1")) }, [conjunto()])?.dificuldade.hash).toBe("h1");
    expect(acharNaBiblioteca({ ...paraRede(conjunto(), dificuldade("h9")) }, [conjunto()])).toBeNull();
  });

  it("quem já tem o mapa não baixa nada", async () => {
    const deps = dependencias({ conjuntos: [conjunto()] });
    await resolverMapa(paraRede(conjunto(), dificuldade("h1")), deps);
    expect(deps.baixarOsz).not.toHaveBeenCalled();
  });

  it("mapa do osu! que falta é baixado e guardado com o status que o host mandou", async () => {
    const deps = dependencias();
    const achado = await resolverMapa(paraRede(conjunto(), dificuldade("h1")), deps);
    expect(deps.baixarOsz).toHaveBeenCalledWith(7);
    expect(deps.guardarDoOsu).toHaveBeenCalledWith(expect.any(Blob), "ranked");
    expect(achado.dificuldade.hash).toBe("h1");
  });

  it("mapa importado vem do host da LAN", async () => {
    const deps = dependencias();
    await resolverMapa(paraRede(conjunto({ origem: "importado", beatmapsetId: undefined }), dificuldade("h1")), deps);
    expect(deps.buscar).toHaveBeenCalledWith("http://192.168.0.5:7777/musica");
    expect(deps.importar).toHaveBeenCalled();
  });

  it("avisa quando o mapa baixado é de outra versão", async () => {
    const deps = dependencias();
    await expect(resolverMapa(paraRede(conjunto(), dificuldade("h9")), deps)).rejects.toThrow(/outra versão/);
  });
});
