import { comAudioFalso } from "@/test/audioFalso";
import { construirSng, construirWav } from "@/test/cloneHero";

const importar = () => comAudioFalso(() => import("./carregamento"));

const CHART = `[Song]
{
  Resolution = 192
}
[SyncTrack]
{
  0 = B 120000
}
[ExpertSingle]
{
  192 = N 0 0
  384 = N 2 0
}
`;

const arquivoSng = (metadados: Record<string, string>, arquivos: Record<string, Uint8Array>, nome = "musica.sng") =>
  new File([construirSng(metadados, arquivos)], nome);

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:capa"), configurable: true });
});

describe("carregarMusica (embutidas)", () => {
  it("gera áudio, notas e batidas", async () => {
    const { carregarMusica } = await importar();
    const { MUSICAS_EMBUTIDAS } = await import("./catalogo");
    const musica = MUSICAS_EMBUTIDAS[0];
    const carregada = await carregarMusica(musica, "medio");
    expect(carregada.notas.length).toBeGreaterThan(50);
    expect(carregada.audio.duration).toBeCloseTo(carregada.duracao, 1);
    expect(carregada.batidas[1].tempo - carregada.batidas[0].tempo).toBeCloseTo(60 / musica.bpm);
  });

  it("reaproveita o áudio sintetizado ao trocar de dificuldade", async () => {
    const { carregarMusica } = await importar();
    const { MUSICAS_EMBUTIDAS } = await import("./catalogo");
    const facil = await carregarMusica(MUSICAS_EMBUTIDAS[0], "facil");
    const expert = await carregarMusica(MUSICAS_EMBUTIDAS[0], "expert");
    expect(expert.audio).toBe(facil.audio);
    expect(expert.notas.length).toBeGreaterThan(facil.notas.length);
  });
});

describe("importarArquivo", () => {
  it("usa o nome 'Artista - Título' de um áudio comum", async () => {
    const { importarArquivo } = await importar();
    const musica = await importarArquivo(new File([construirWav(1, 440)], "Banda X - Música Y.wav"));
    expect(musica).toMatchObject({ titulo: "Música Y", artista: "Banda X" });
    expect(musica.sng).toBeFalsy();
  });

  it("marca clipes de vídeo pela extensão", async () => {
    const { importarArquivo } = await importar();
    expect((await importarArquivo(new File([], "clipe.mp4"))).video).toBe(true);
  });

  // Bug do projeto antigo: a expressão sem barra aceitava qualquer nome terminado em "mp4".
  it("não confunde um nome que só termina em 'mp4' com vídeo", async () => {
    const { ehVideo } = await importar();
    expect(ehVideo(new File([], "musicamp4"))).toBe(false);
  });

  it("lê título, artista, gênero e capa de dentro do .sng", async () => {
    const { importarArquivo } = await importar();
    const arquivo = arquivoSng(
      { name: "Hino", artist: "Os Testes", genre: "Rock" },
      { "notes.chart": new TextEncoder().encode(CHART), "song.wav": construirWav(1, 220), "album.png": Uint8Array.of(1) },
    );
    expect(await importarArquivo(arquivo)).toMatchObject({
      titulo: "Hino",
      artista: "Os Testes",
      genero: "Rock",
      sng: true,
      imagemDeCapa: "blob:capa",
    });
  });

  it("avisa o progresso do .sng, sempre crescendo, até terminar", async () => {
    const { importarArquivo } = await importar();
    const arquivo = arquivoSng({}, { "notes.chart": new TextEncoder().encode(CHART), "song.wav": construirWav(1, 220), "guitar.wav": construirWav(1, 330) });
    const progresso: number[] = [];
    await importarArquivo(arquivo, (fracao) => progresso.push(fracao));
    expect(progresso.length).toBeGreaterThan(2);
    expect(progresso).toEqual([...progresso].sort((a, b) => a - b));
    expect(progresso.at(-1)).toBe(1);
  });

  it("um áudio comum termina na hora", async () => {
    const { importarArquivo } = await importar();
    const aoProgredir = vi.fn();
    await importarArquivo(new File([construirWav(1, 440)], "tom.wav"), aoProgredir);
    expect(aoProgredir).toHaveBeenLastCalledWith(1);
  });

  it("recusa .sng sem chart", async () => {
    const { importarArquivo } = await importar();
    await expect(importarArquivo(arquivoSng({}, { "song.wav": construirWav(1, 220) }))).rejects.toThrow("chart");
  });
});

describe("carregarMusica (importadas)", () => {
  it("carrega o .sng mixando as faixas e aplicando o delay do song.ini", async () => {
    const { carregarMusica, importarArquivo } = await importar();
    const arquivo = arquivoSng(
      { delay: "100" },
      { "notes.chart": new TextEncoder().encode(CHART), "song.wav": construirWav(2, 220), "guitar.wav": construirWav(1, 330) },
    );
    const carregada = await carregarMusica(await importarArquivo(arquivo), "dificil");
    expect(carregada.notas.map((n) => +n.tempo.toFixed(2))).toEqual([0.4, 0.9]);
    expect(carregada.audio.numberOfChannels).toBe(2);
    expect(carregada.duracao).toBeCloseTo(2);
  });

  it("gera o chart automático de um áudio comum", async () => {
    const { carregarMusica, importarArquivo } = await importar();
    const musica = await importarArquivo(new File([construirWav(2, 440)], "tom.wav"));
    const carregada = await carregarMusica(musica, "expert");
    expect(carregada.duracao).toBeCloseTo(2);
    expect(Array.isArray(carregada.notas)).toBe(true);
  });
});
