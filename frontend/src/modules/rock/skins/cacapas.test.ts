import { CACAPA_PADRAO, CACAPAS_PRONTAS, FORMATOS_DA_CACAPA, cacapaPorId } from "./cacapas";

describe("caçapas prontas", () => {
  it("tem ids únicos e pelo menos uma de cada formato", () => {
    expect(new Set(CACAPAS_PRONTAS.map((c) => c.id)).size).toBe(CACAPAS_PRONTAS.length);
    for (const formato of FORMATOS_DA_CACAPA) expect(CACAPAS_PRONTAS.some((c) => c.formato === formato)).toBe(true);
  });

  it("cada uma tem uma cor para cada traste e para a aberta", () => {
    for (const cacapa of CACAPAS_PRONTAS) {
      expect(cacapa.cores.trastes).toHaveLength(5);
      expect(cacapa.cores.aberta).toMatch(/^#/);
    }
  });

  it("a padrão é a primeira, redonda", () => {
    expect(CACAPAS_PRONTAS[0]).toBe(CACAPA_PADRAO);
    expect(CACAPA_PADRAO.formato).toBe("redonda");
  });
});

describe("cacapaPorId", () => {
  it("acha uma pronta e volta para a padrão quando não existe", () => {
    expect(cacapaPorId(CACAPAS_PRONTAS[1].id)).toBe(CACAPAS_PRONTAS[1]);
    expect(cacapaPorId("sumiu")).toBe(CACAPA_PADRAO);
  });
});
