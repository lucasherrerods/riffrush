import { andamento, construirMidi, construirSng, nomeDaFaixa, notaDesligada, notaLigada } from "@/test/cloneHero";
import { MapaDeTempo, dificuldadesDoChart, escolherDificuldade, lerChart, lerMidi, lerSng } from "./cloneHero";

const resumo = (notas: { tempo: number; pista: number; duracao: number; frase: number }[]) =>
  notas.map((n) => `${n.tempo.toFixed(3)}:${n.pista}${n.duracao ? ` s${n.duracao.toFixed(2)}` : ""}${n.frase >= 0 ? " *" : ""}`);

describe("MapaDeTempo", () => {
  it("converte ticks em segundos num andamento fixo", () => {
    const mapa = new MapaDeTempo(192, [{ tick: 0, microssegundosPorSeminima: 500000 }]);
    expect(mapa.emSegundos(192)).toBeCloseTo(0.5);
    expect(mapa.emSegundos(960)).toBeCloseTo(2.5);
  });

  it("acompanha as mudanças de andamento", () => {
    const mapa = new MapaDeTempo(100, [
      { tick: 0, microssegundosPorSeminima: 500000 },
      { tick: 200, microssegundosPorSeminima: 1000000 },
    ]);
    expect(mapa.emSegundos(200)).toBeCloseTo(1);
    expect(mapa.emSegundos(300)).toBeCloseTo(2);
  });

  it("usa 120 BPM quando não há andamento", () => {
    expect(new MapaDeTempo(480, []).emSegundos(480)).toBeCloseTo(0.5);
  });

  it("gera uma batida por semínima, com tempo forte a cada 4", () => {
    const batidas = new MapaDeTempo(192, []).batidas(2);
    expect(batidas.map((b) => b.tempo)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(batidas.map((b) => b.forte)).toEqual([true, false, false, false, true]);
  });
});

const CHART = `[Song]
{
  Resolution = 192
  Name = "Teste"
}
[SyncTrack]
{
  0 = TS 4
  0 = B 120000
}
[ExpertSingle]
{
  192 = N 0 0
  384 = N 1 96
  576 = N 2 0
  576 = N 4 0
  768 = S 2 384
  768 = N 3 0
  960 = N 0 0
  960 = N 7 0
}
[EasySingle]
{
  192 = N 1 0
}
`;

describe("lerChart", () => {
  const chart = lerChart(CHART);

  it("lê notas, acordes, sustains e star power do expert", () => {
    expect(resumo(chart.notas.expert!)).toEqual(["0.500:0", "1.000:1 s0.25", "1.500:2", "1.500:4", "2.000:3 *", "2.500:0 *"]);
  });

  it("ignora a nota aberta (7) e os marcadores", () => {
    expect(chart.notas.expert!.every((n) => n.pista <= 4)).toBe(true);
  });

  it("lê cada dificuldade separada e deixa de fora as que não existem", () => {
    expect(chart.notas.facil).toHaveLength(1);
    expect(chart.notas.medio).toBeUndefined();
  });
});

describe("lerMidi", () => {
  const midi = construirMidi(
    480,
    [andamento(500000)],
    [
      nomeDaFaixa("PART GUITAR"),
      notaLigada(480, 96),
      notaDesligada(240, 96),
      notaLigada(180, 116),
      notaLigada(60, 98),
      notaDesligada(60, 98),
      notaDesligada(140, 116),
      notaLigada(0, 64),
      notaDesligada(120, 64),
    ],
  );

  it("lê as notas do expert com sustain e star power", () => {
    expect(resumo(lerMidi(midi).notas.expert!)).toEqual(["0.500:0 s0.25", "1.000:2 *"]);
  });

  it("lê as outras dificuldades pelas faixas de notas MIDI", () => {
    expect(lerMidi(midi).notas.facil).toHaveLength(1);
  });

  it("procura a guitarra pelo nome da faixa, ignorando outras partes", () => {
    const comBateria = construirMidi(
      480,
      [andamento(500000)],
      [nomeDaFaixa("PART DRUMS"), notaLigada(0, 97), notaDesligada(10, 97)],
      [nomeDaFaixa("PART GUITAR"), notaLigada(960, 100), notaDesligada(10, 100)],
    );
    expect(resumo(lerMidi(comBateria).notas.expert!)).toEqual(["1.000:4"]);
  });

  // Bug: sem faixa de guitarra, o baixo (ou qualquer faixa com notas na mesma altura) virava a guitarra.
  it("sem faixa de guitarra, não lê nenhuma dificuldade", () => {
    const semGuitarra = construirMidi(
      480,
      [andamento(500000)],
      [nomeDaFaixa("PART BASS"), notaLigada(0, 97), notaDesligada(10, 97)],
      [nomeDaFaixa("PART DRUMS"), notaLigada(0, 98), notaDesligada(10, 98)],
    );
    expect(lerMidi(semGuitarra).notas).toEqual({});
  });

  it("recusa arquivos que não são MIDI", () => {
    expect(() => lerMidi(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });
});

describe("lerSng", () => {
  const conteudo = new TextEncoder().encode("olá");
  const sng = construirSng({ Name: "Música", artist: "Banda" }, { "notes.chart": conteudo, "Album.PNG": Uint8Array.of(1, 2, 3) });

  it("lê os metadados com as chaves em minúsculo", () => {
    expect(lerSng(sng.buffer).metadados).toEqual({ name: "Música", artist: "Banda" });
  });

  it("desfaz a máscara XOR dos arquivos", () => {
    expect(new TextDecoder().decode(lerSng(sng.buffer).arquivos.get("notes.chart"))).toBe("olá");
  });

  it("guarda os nomes dos arquivos em minúsculo", () => {
    expect([...lerSng(sng.buffer).arquivos.keys()]).toEqual(["notes.chart", "album.png"]);
  });

  it("recusa arquivos que não são .sng", () => {
    expect(() => lerSng(new TextEncoder().encode("qualquer coisa").buffer)).toThrow(".sng inválido");
  });
});

describe("dificuldadesDoChart", () => {
  it("lista, em ordem, só as dificuldades que têm notas", () => {
    expect(dificuldadesDoChart(lerChart(CHART))).toEqual(["facil", "expert"]);
  });
});

describe("escolherDificuldade", () => {
  const chart = lerChart(CHART);

  it("devolve a dificuldade pedida quando ela existe", () => {
    expect(escolherDificuldade(chart, "facil")).toHaveLength(1);
  });

  it("usa a dificuldade mais próxima quando a pedida não existe", () => {
    expect(escolherDificuldade(chart, "dificil")).toBe(chart.notas.expert);
    expect(escolherDificuldade(chart, "medio")).toBe(chart.notas.facil);
  });
});
