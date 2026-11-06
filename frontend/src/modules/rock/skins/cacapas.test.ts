import { ESQUEMA_PADRAO, ESQUEMAS_DE_CORES, FORMATOS_DA_CACAPA, esquemaPorId, estiloDaCacapa } from "./cacapas";

describe("formatos", () => {
  it("redonda, retangular e hexagonal, com nome para a tela", () => {
    expect(FORMATOS_DA_CACAPA.map((f) => f.id)).toEqual(["redonda", "retangular", "hexagonal"]);
    for (const f of FORMATOS_DA_CACAPA) expect(f.nome).toBeTruthy();
  });
});

describe("esquemas de cores", () => {
  it("tem ids únicos, 5 trastes e a aberta em cada um", () => {
    expect(new Set(ESQUEMAS_DE_CORES.map((e) => e.id)).size).toBe(ESQUEMAS_DE_CORES.length);
    for (const e of ESQUEMAS_DE_CORES) {
      expect(e.cores.trastes).toHaveLength(5);
      expect(e.cores.aberta).toMatch(/^#/);
    }
  });

  it("tem esquemas pensados para daltonismo", () => {
    expect(ESQUEMAS_DE_CORES.filter((e) => e.acessivel).length).toBeGreaterThanOrEqual(2);
  });

  it("nos esquemas acessíveis, os cinco trastes têm cores diferentes", () => {
    for (const e of ESQUEMAS_DE_CORES.filter((e) => e.acessivel)) expect(new Set(e.cores.trastes).size).toBe(5);
  });

  it("volta para a clássica quando o id não existe", () => {
    expect(esquemaPorId("sumiu")).toBe(ESQUEMA_PADRAO);
    expect(ESQUEMA_PADRAO.id).toBe("classica");
  });
});

describe("estiloDaCacapa", () => {
  it("combina qualquer formato com qualquer esquema", () => {
    expect(estiloDaCacapa("hexagonal", "daltonismo", 0.5, true)).toMatchObject({ formato: "hexagonal", cores: esquemaPorId("daltonismo").cores, brilho: 0.5, contornoForte: true });
  });

  it("o brilho fica entre 0 e 1", () => {
    expect(estiloDaCacapa("redonda", "classica", 3, false).brilho).toBe(1);
    expect(estiloDaCacapa("redonda", "classica", -1, false).brilho).toBe(0);
  });

  it("as mesmas escolhas devolvem o mesmo objeto, para a partida não reiniciar", () => {
    expect(estiloDaCacapa("retangular", "neon", 0.7, false)).toBe(estiloDaCacapa("retangular", "neon", 0.7, false));
  });
});
