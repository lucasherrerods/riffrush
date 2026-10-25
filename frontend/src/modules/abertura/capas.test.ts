import { CAPAS_DAS_BANDAS } from "./capasDasBandas";
import { MINIMO_DE_CAPAS, carregarCapas } from "./capas";

const imagem = () => new Image();

describe("carregarCapas", () => {
  it("devolve só as capas que carregaram", async () => {
    const baixar = vi.fn(async (url: string) => {
      if (url === "b") throw new Error("fora do ar");
      return new Blob([url]);
    });
    const capas = await carregarCapas(["a", "b", "c"], { baixar, abrir: async () => imagem() });
    expect(capas).toHaveLength(2);
  });

  it("não espera além do tempo máximo", async () => {
    const baixar = (url: string) => (url === "lenta" ? new Promise<Blob>(() => {}) : Promise.resolve(new Blob([url])));
    const capas = await carregarCapas(["rapida", "lenta"], { tempoMaximoMs: 20, baixar, abrir: async () => imagem() });
    expect(capas).toHaveLength(1);
  });
});

describe("CAPAS_DAS_BANDAS", () => {
  it("tem capas de sobra para a abertura, sem repetir", () => {
    expect(CAPAS_DAS_BANDAS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(CAPAS_DAS_BANDAS.map((c) => c.url)).size).toBe(CAPAS_DAS_BANDAS.length);
    expect(CAPAS_DAS_BANDAS.length).toBeGreaterThan(MINIMO_DE_CAPAS);
  });

  it("todas vêm do servidor de imagens da Apple, em https", () => {
    for (const { url } of CAPAS_DAS_BANDAS) expect(url).toMatch(/^https:\/\/is\d-ssl\.mzstatic\.com\/image\/thumb\/.+\/600x600bb\.jpg$/);
  });
});
