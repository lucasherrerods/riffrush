import { construirSng } from "@/test/cloneHero";
import { audioDaPrevia, buscarPreviaDoChart, inicioDaPrevia } from "./previa";
import type { ResultadoDaBusca } from "./encore";

const resultado: ResultadoDaBusca = {
  md5: "0f9d8f1ac3194d5850ad5e101be9cdf5",
  titulo: "Música",
  artista: "Banda",
  album: "",
  genero: "",
  ano: "",
  charter: "",
  duracaoMs: 200_000,
  instrumentos: [],
  versaoDoEncoder: 0,
  temVideo: false,
};

/** Um servidor que responde pedidos por faixa de bytes, como o do Encore. */
function servidor(pacote: Uint8Array) {
  const pedidos: string[] = [];
  const buscar = vi.fn(async (_url: string, init?: RequestInit) => {
    const faixa = new Headers(init?.headers).get("Range") ?? "";
    pedidos.push(faixa);
    const [, de, ate] = /bytes=(\d+)-(\d+)/.exec(faixa) ?? [];
    return new Response(pacote.slice(Number(de), Number(ate) + 1), { status: 206 });
  });
  return { buscar: buscar as unknown as typeof fetch, pedidos };
}

describe("audioDaPrevia", () => {
  it("prefere a prévia que o chart traz, depois a música inteira", () => {
    expect(audioDaPrevia(["notes.chart", "song.ogg", "preview.ogg"])).toBe("preview.ogg");
    expect(audioDaPrevia(["notes.chart", "guitar.opus", "song.opus"])).toBe("song.opus");
  });

  it("usa uma das faixas separadas quando não há música inteira", () => {
    expect(audioDaPrevia(["notes.mid", "guitar.ogg", "drums_1.ogg"])).toBe("guitar.ogg");
  });

  it("devolve null sem áudio", () => {
    expect(audioDaPrevia(["notes.chart", "album.png"])).toBeNull();
  });
});

describe("inicioDaPrevia", () => {
  it("usa o ponto que o charter marcou no song.ini", () => {
    expect(inicioDaPrevia({ preview_start_time: "42000" }, 200_000)).toBe(42);
  });

  it("começa perto do meio quando o ponto falta ou passa do fim", () => {
    expect(inicioDaPrevia({}, 200_000)).toBe(70);
    expect(inicioDaPrevia({ preview_start_time: "-1" }, 200_000)).toBe(70);
    expect(inicioDaPrevia({ preview_start_time: "999000" }, 200_000)).toBe(70);
  });

  it("começa do zero numa prévia separada, que já é o trecho", () => {
    expect(inicioDaPrevia({ preview_start_time: "42000" }, 200_000, "preview.ogg")).toBe(0);
  });
});

describe("buscarPreviaDoChart", () => {
  const audio = Uint8Array.from({ length: 300 }, (_, i) => i & 0xff);
  const pacote = construirSng({ preview_start_time: "15000" }, { "notes.chart": new Uint8Array(100), "song.ogg": audio });

  it("pede só o começo do pacote e a faixa de áudio, sem baixar o resto", async () => {
    const { buscar, pedidos } = servidor(pacote);
    const previa = await buscarPreviaDoChart(resultado, { buscar });
    expect(pedidos).toHaveLength(2);
    expect(pedidos[0]).toMatch(/^bytes=0-/);
    expect(new Uint8Array(await previa.audio.arrayBuffer())).toEqual(audio);
    expect(previa.audio.type).toBe("audio/ogg");
    expect(previa.inicioS).toBe(15);
  });

  it("pede o índice de novo quando ele passa do primeiro pedaço", async () => {
    const nomes = Object.fromEntries(Array.from({ length: 3000 }, (_, i) => [`capa${i}.png`, Uint8Array.of(1)]));
    const grande = construirSng({}, { ...nomes, "song.ogg": audio });
    const { buscar, pedidos } = servidor(grande);
    const previa = await buscarPreviaDoChart(resultado, { buscar });
    expect(pedidos).toHaveLength(3);
    expect(new Uint8Array(await previa.audio.arrayBuffer())).toEqual(audio);
  });

  it("avisa quando o chart não tem áudio", async () => {
    const { buscar } = servidor(construirSng({}, { "notes.chart": Uint8Array.of(1) }));
    await expect(buscarPreviaDoChart(resultado, { buscar })).rejects.toThrow("não tem áudio");
  });

  it("avisa quando o Encore não responde", async () => {
    const buscar = vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await expect(buscarPreviaDoChart(resultado, { buscar })).rejects.toThrow("prévia");
  });
});
