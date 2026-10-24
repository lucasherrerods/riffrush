import { LIMITE_PARA_AVISAR, baixarDoEncore, baixarSng, formatarTamanho } from "./download";
import type { ResultadoDaBusca } from "./encore";

const resultado: ResultadoDaBusca = {
  md5: "8d633d2940da9b3acda9074c2385e672",
  titulo: "Hit",
  artista: "Banda",
  album: "",
  genero: "",
  ano: "",
  charter: "",
  duracaoMs: 0,
  instrumentos: [],
  versaoDoEncoder: 0,
  temVideo: false,
};

const SNG = new TextEncoder().encode("SNGPKG resto do pacote");

/** Resposta que chega em pedaços, como um download de verdade. */
function respostaEmPedacos(pedacos: Uint8Array[], { status = 200, tamanho = pedacos.reduce((t, p) => t + p.length, 0) } = {}) {
  const corpo = new ReadableStream<Uint8Array>({
    start(controle) {
      pedacos.forEach((p) => controle.enqueue(p));
      controle.close();
    },
  });
  return new Response(corpo, { status, headers: { "Content-Length": String(tamanho) } });
}

describe("baixarDoEncore", () => {
  it("baixa o .sng e devolve um arquivo com o nome da música", async () => {
    const buscar = vi.fn(async () => respostaEmPedacos([SNG]));
    const arquivo = await baixarDoEncore(resultado, { buscar });
    expect(buscar).toHaveBeenCalledWith(`https://files.enchor.us/${resultado.md5}.sng`, expect.anything());
    expect(arquivo?.name).toBe("Banda - Hit.sng");
    expect(Array.from(new Uint8Array(await arquivo!.arrayBuffer()))).toEqual(Array.from(SNG));
  });

  it("avisa o progresso conforme os pedaços chegam", async () => {
    const aoProgredir = vi.fn();
    await baixarDoEncore(resultado, { buscar: async () => respostaEmPedacos([SNG.slice(0, 11), SNG.slice(11)]), aoProgredir });
    expect(aoProgredir.mock.calls.map(([f]) => f)).toEqual([0.5, 1]);
  });

  it("pede confirmação antes de baixar arquivos grandes, e para se o jogador recusar", async () => {
    const confirmarTamanho = vi.fn(async () => false);
    const arquivo = await baixarDoEncore(resultado, { buscar: async () => respostaEmPedacos([SNG], { tamanho: LIMITE_PARA_AVISAR + 1 }), confirmarTamanho });
    expect(confirmarTamanho).toHaveBeenCalledWith(LIMITE_PARA_AVISAR + 1);
    expect(arquivo).toBeNull();
  });

  it("arquivo pequeno não pede confirmação", async () => {
    const confirmarTamanho = vi.fn(async () => false);
    await baixarDoEncore(resultado, { buscar: async () => respostaEmPedacos([SNG]), confirmarTamanho });
    expect(confirmarTamanho).not.toHaveBeenCalled();
  });

  it("explica quando o chart saiu do Encore", async () => {
    await expect(baixarDoEncore(resultado, { buscar: async () => new Response("", { status: 404 }) })).rejects.toThrow(/não está mais no Encore/);
  });

  it("recusa o que não é um pacote .sng", async () => {
    const buscar = async () => respostaEmPedacos([new TextEncoder().encode("<html>erro</html>")]);
    await expect(baixarDoEncore(resultado, { buscar })).rejects.toThrow(/não é um .sng válido/);
  });

  it("explica quando a rede cai", async () => {
    await expect(baixarDoEncore(resultado, { buscar: async () => Promise.reject(new TypeError("Failed to fetch")) })).rejects.toThrow(/conexão/);
  });
});

describe("formatarTamanho", () => {
  it("mostra em MB, e em GB a partir de 1 GB", () => {
    expect(formatarTamanho(420 * 1024 * 1024)).toBe("420 MB");
    expect(formatarTamanho(1.5 * 1024 * 1024 * 1024)).toBe("1,5 GB");
  });
});

describe("baixarSng", () => {
  it("baixa de uma URL do Encore já montada, com o nome pedido", async () => {
    const buscar = vi.fn(async () => respostaEmPedacos([SNG]));
    const arquivo = await baixarSng("https://files.enchor.us/charts/v2/abc.sng", "Banda - Hit.sng", { buscar });
    expect(buscar).toHaveBeenCalledWith("https://files.enchor.us/charts/v2/abc.sng", expect.anything());
    expect(arquivo?.name).toBe("Banda - Hit.sng");
  });

  it("recusa URL que não é do Encore", async () => {
    const buscar = vi.fn();
    await expect(baixarSng("https://malicioso.com/a.sng", "a.sng", { buscar })).rejects.toThrow(/não é do Encore/);
    expect(buscar).not.toHaveBeenCalled();
  });
});
