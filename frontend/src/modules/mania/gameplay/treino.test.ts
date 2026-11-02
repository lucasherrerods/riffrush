import { mapaDoTrecho, trechosDoMapa } from "./treino";

const osu = ({ editor = "", eventos = "", pontos = "0,500,4,2,0,40,1,0", notas = "" }) =>
  `osu file format v14\n\n[General]\nMode: 3\n\n[Editor]\n${editor}\n\n[Events]\n${eventos}\n\n[TimingPoints]\n${pontos}\n\n[HitObjects]\n${notas}\n`;

describe("trechosDoMapa", () => {
  it("usa os bookmarks do autor como começo de cada parte", () => {
    const texto = osu({ editor: "Bookmarks: 4000,10000", notas: "64,192,1000,1,0,0:0:0:0:\n64,192,5000,1,0,0:0:0:0:\n64,192,12000,1,0,0:0:0:0:" });
    expect(trechosDoMapa(texto, 16)).toEqual([
      { nome: "Começo", inicio: 0, fim: 4 },
      { nome: "Parte 1", inicio: 4, fim: 10 },
      { nome: "Parte 2", inicio: 10, fim: 16 },
    ]);
  });

  it("sem bookmarks, divide em blocos de 8 compassos pelos pontos de tempo", () => {
    // 120 BPM em 4/4: um compasso a cada 2 s, bloco de 8 a cada 16 s.
    const notas = [1000, 17000, 33000].map((t) => `64,192,${t},1,0,0:0:0:0:`).join("\n");
    expect(trechosDoMapa(osu({ notas }), 40).map((t) => [t.nome, t.inicio, t.fim])).toEqual([
      ["Compassos 1–8", 0, 16],
      ["Compassos 9–16", 16, 32],
      ["Compassos 17–20", 32, 40],
    ]);
  });

  it("segue a mudança de compasso e ignora os pontos herdados", () => {
    // 3/4 a 120 BPM: compasso de 1,5 s. O ponto herdado (beatLength negativo) não muda nada.
    const texto = osu({ pontos: "0,500,3,2,0,40,1,0\n3000,-50,4,2,0,40,0,0", notas: "64,192,1000,1,0,0:0:0:0:" });
    expect(trechosDoMapa(texto, 3)[0]).toEqual({ nome: "Compassos 1–2", inicio: 0, fim: 3 });
  });

  it("deixa de fora as partes sem nota, que o motor não aceita", () => {
    const texto = osu({ editor: "Bookmarks: 4000,10000", notas: "64,192,5000,1,0,0:0:0:0:" });
    expect(trechosDoMapa(texto, 16).map((t) => t.nome)).toEqual(["Parte 1"]);
  });
});

describe("mapaDoTrecho", () => {
  it("fica só com as notas que começam no trecho e corta a nota longa no fim dele", () => {
    const texto = osu({ notas: "64,192,1000,1,0,0:0:0:0:\n64,192,4000,128,0,9000:0:0:0:0:\n192,192,5000,1,0,0:0:0:0:\n64,192,6000,1,0,0:0:0:0:" });
    const recortado = mapaDoTrecho(texto, { nome: "Riff", inicio: 4, fim: 6 });
    expect(recortado.split("[HitObjects]\n")[1].trim().split("\n")).toEqual(["64,192,4000,128,0,6000:0:0:0:0:", "192,192,5000,1,0,0:0:0:0:"]);
    expect(recortado.split("[HitObjects]")[0]).toBe(texto.split("[HitObjects]")[0]);
  });

  it("aceita quebras de linha do Windows", () => {
    const texto = osu({ notas: "64,192,1000,1,0,0:0:0:0:\n64,192,5000,1,0,0:0:0:0:" }).replace(/\n/g, "\r\n");
    expect(mapaDoTrecho(texto, { nome: "Riff", inicio: 4, fim: 6 })).toContain("64,192,5000,1,0,0:0:0:0:");
    expect(mapaDoTrecho(texto, { nome: "Riff", inicio: 4, fim: 6 })).not.toContain(",1000,");
  });
});
