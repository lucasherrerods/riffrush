import { andamento, construirMidi, construirSng, nomeDaFaixa, notaDesligada, notaLigada } from "@/test/cloneHero";
import { MapaDeTempo, escolherTrilha, lerChart, lerMidi, lerSng, trilhasDoChart } from "./cloneHero";

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
[HardDoubleBass]
{
  192 = N 2 0
}
[ExpertDoubleRhythm]
{
  192 = N 3 0
}
[ExpertDoubleGuitar]
{
  192 = N 4 0
}
[ExpertKeyboard]
{
  192 = N 0 0
}
[ExpertDrums]
{
  192 = N 1 0
}
`;

describe("lerChart", () => {
  const chart = lerChart(CHART);

  it("lê notas, acordes, sustains e star power do expert", () => {
    expect(resumo(chart.notas.guitarra!.expert!)).toEqual(["0.500:0", "1.000:1 s0.25", "1.500:2", "1.500:4", "2.000:3 *", "2.500:0 *"]);
  });


  it("lê cada dificuldade separada e deixa de fora as que não existem", () => {
    expect(chart.notas.guitarra!.facil).toHaveLength(1);
    expect(chart.notas.guitarra!.medio).toBeUndefined();
  });

  it("lê baixo, rítmica, coop e teclado das seções de cada instrumento, e deixa a bateria de fora", () => {
    expect(resumo(chart.notas.baixo!.dificil!)).toEqual(["0.500:2"]);
    expect(resumo(chart.notas.ritmica!.expert!)).toEqual(["0.500:3"]);
    expect(resumo(chart.notas.coop!.expert!)).toEqual(["0.500:4"]);
    expect(resumo(chart.notas.teclado!.expert!)).toEqual(["0.500:0"]);
    expect(Object.keys(chart.notas)).toEqual(["guitarra", "baixo", "ritmica", "coop", "teclado"]);
  });
});

const tipos = (notas: { tempo: number; pista: number; tipo?: string }[]) => notas.map((n) => `${n.pista}${n.tipo ? ":" + n.tipo : ""}`);
const chartCom = (notas: string) => lerChart(`[Song]
{
  Resolution = 192
}
[ExpertSingle]
{
${notas}
}`).notas.guitarra!.expert!;

describe("lerChart: notas abertas, HOPO e tap", () => {
  it("a nota aberta (7) vira a pista 5", () => {
    expect(tipos(chartCom(`0 = N 7 0
768 = N 7 96`))).toEqual(["5", "5"]);
  });

  it("aberta junto com traste não vale: fica o traste, como no Clone Hero", () => {
    expect(tipos(chartCom(`0 = N 0 0
0 = N 7 0`))).toEqual(["0"]);
  });

  it("nota simples perto da anterior e de outra cor vira HOPO natural", () => {
    // Limiar do .chart: 65/192 da semínima. 64 ticks passa, 96 não.
    expect(tipos(chartCom(`0 = N 0 0
64 = N 1 0
160 = N 2 0
224 = N 2 0`))).toEqual(["0", "1:hopo", "2", "2"]);
  });

  it("acorde não é HOPO natural, e nota que já estava no acorde anterior também não", () => {
    expect(tipos(chartCom(`0 = N 0 0
64 = N 1 0
64 = N 2 0
128 = N 1 0
192 = N 3 0`))).toEqual(["0", "1", "2", "1", "3:hopo"]);
  });

  it("o marcador 5 inverte o HOPO natural; o 6 deixa a nota tap", () => {
    expect(tipos(chartCom(`0 = N 0 0
64 = N 1 0
64 = N 5 0
500 = N 2 0
500 = N 5 0
900 = N 3 0
900 = N 6 0`))).toEqual(["0", "1", "2:hopo", "3:tap"]);
  });

  it("a nota aberta também pode ser HOPO", () => {
    expect(tipos(chartCom(`0 = N 0 0
64 = N 7 0`))).toEqual(["0", "5:hopo"]);
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
    expect(resumo(lerMidi(midi).notas.guitarra!.expert!)).toEqual(["0.500:0 s0.25", "1.000:2 *"]);
  });

  it("lê as outras dificuldades pelas faixas de notas MIDI", () => {
    expect(lerMidi(midi).notas.guitarra!.facil).toHaveLength(1);
  });

  it("procura a guitarra pelo nome da faixa, ignorando outras partes", () => {
    const comBateria = construirMidi(
      480,
      [andamento(500000)],
      [nomeDaFaixa("PART DRUMS"), notaLigada(0, 97), notaDesligada(10, 97)],
      [nomeDaFaixa("PART GUITAR"), notaLigada(960, 100), notaDesligada(10, 100)],
    );
    expect(resumo(lerMidi(comBateria).notas.guitarra!.expert!)).toEqual(["1.000:4"]);
  });

  it("lê cada parte de instrumento na própria trilha, e não a bateria", () => {
    const banda = construirMidi(
      480,
      [andamento(500000)],
      [nomeDaFaixa("PART DRUMS"), notaLigada(0, 98), notaDesligada(10, 98)],
      [nomeDaFaixa("PART BASS"), notaLigada(960, 97), notaDesligada(10, 97)],
      [nomeDaFaixa("PART RHYTHM"), notaLigada(960, 86), notaDesligada(10, 86)],
      [nomeDaFaixa("PART GUITAR COOP"), notaLigada(960, 96), notaDesligada(10, 96)],
      [nomeDaFaixa("PART KEYS"), notaLigada(960, 99), notaDesligada(10, 99)],
    );
    const { notas } = lerMidi(banda);
    expect(resumo(notas.baixo!.expert!)).toEqual(["1.000:1"]);
    expect(resumo(notas.ritmica!.dificil!)).toEqual(["1.000:2"]);
    expect(resumo(notas.coop!.expert!)).toEqual(["1.000:0"]);
    expect(resumo(notas.teclado!.expert!)).toEqual(["1.000:3"]);
    expect(notas.guitarra).toBeUndefined();
  });

  it("uma faixa sem nome com notas de guitarra vira a guitarra", () => {
    const semNome = construirMidi(480, [andamento(500000)], [notaLigada(960, 96), notaDesligada(10, 96)]);
    expect(resumo(lerMidi(semNome).notas.guitarra!.expert!)).toEqual(["1.000:0"]);
  });

  it("recusa arquivos que não são MIDI", () => {
    expect(() => lerMidi(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });
});

describe("lerMidi: notas abertas, HOPO e tap", () => {
  const texto = (delta: number, conteudo: string) => ({ delta, bytes: [0xff, 0x01, conteudo.length, ...new TextEncoder().encode(conteudo)] });
  // Phase Shift: F0, tamanho, "PS", 0, 0, dificuldade (3 = expert, 0xFF = todas), tipo (1 = aberta, 4 = tap), liga/desliga, F7.
  const sysex = (delta: number, dificuldade: number, tipo: number, liga: boolean) => ({ delta, bytes: [0xf0, 8, 0x50, 0x53, 0, 0, dificuldade, tipo, liga ? 1 : 0, 0xf7] });
  const ler = (...eventos: { delta: number; bytes: number[] }[]) => lerMidi(construirMidi(480, [andamento(500000)], [nomeDaFaixa("PART GUITAR"), ...eventos])).notas.guitarra!.expert!;

  it("com ENHANCED_OPENS, a nota logo abaixo do verde é a aberta", () => {
    expect(tipos(ler(texto(0, "[ENHANCED_OPENS]"), notaLigada(0, 95), notaDesligada(60, 95), notaLigada(900, 96), notaDesligada(60, 96)))).toEqual(["5", "0"]);
  });

  it("o sysex do Phase Shift transforma o verde em aberta, e outro sysex deixa tap", () => {
    expect(
      tipos(
        ler(sysex(0, 3, 1, true), notaLigada(0, 96), notaDesligada(60, 96), sysex(0, 3, 1, false), sysex(900, 0xff, 4, true), notaLigada(0, 97), notaDesligada(60, 97), sysex(0, 0xff, 4, false)),
      ),
    ).toEqual(["5", "1:tap"]);
  });

  it("HOPO natural pelo limiar, forçado pela nota 101, nota normal forçada pela 102, e tap pela 104", () => {
    expect(
      tipos(
        ler(
          notaLigada(0, 96), notaDesligada(10, 96),
          notaLigada(100, 97), notaDesligada(10, 97), // 110 ticks depois: HOPO natural
          notaLigada(100, 102), notaLigada(0, 98), notaDesligada(10, 98), notaDesligada(0, 102), // natural, mas forçada a normal
          notaLigada(900, 101), notaLigada(0, 99), notaDesligada(10, 99), notaDesligada(0, 101), // longe, mas forçada a HOPO
          notaLigada(900, 104), notaLigada(0, 100), notaDesligada(10, 100), notaDesligada(0, 104),
        ),
      ),
    ).toEqual(["0", "1:hopo", "2", "3:hopo", "4:tap"]);
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

describe("trilhasDoChart", () => {
  it("lista, em ordem, os instrumentos e só as dificuldades que têm notas", () => {
    expect(trilhasDoChart(lerChart(CHART))).toEqual({
      guitarra: ["facil", "expert"],
      baixo: ["dificil"],
      ritmica: ["expert"],
      coop: ["expert"],
      teclado: ["expert"],
    });
  });
});

describe("escolherTrilha", () => {
  const chart = lerChart(CHART);

  it("devolve o instrumento e a dificuldade pedidos quando existem", () => {
    expect(escolherTrilha(chart, "guitarra", "facil")).toHaveLength(1);
    expect(escolherTrilha(chart, "baixo", "dificil")).toBe(chart.notas.baixo!.dificil);
  });

  it("usa a dificuldade mais próxima do instrumento quando a pedida não existe", () => {
    expect(escolherTrilha(chart, "guitarra", "dificil")).toBe(chart.notas.guitarra!.expert);
    expect(escolherTrilha(chart, "guitarra", "medio")).toBe(chart.notas.guitarra!.facil);
    expect(escolherTrilha(chart, "baixo", "facil")).toBe(chart.notas.baixo!.dificil);
  });

  it("sem o instrumento pedido, usa o primeiro que o chart tem", () => {
    const soBaixo = lerChart("[HardDoubleBass]\n{\n  0 = N 1 0\n}");
    expect(escolherTrilha(soBaixo, "guitarra", "expert")).toBe(soBaixo.notas.baixo!.dificil);
  });
});
