import { entradasDoLoteDoMania, entradasParaOLoteDoMania, estadoTocandoNoMania, partidaParaTransmitirNoMania } from "./protocolo";

it("cada entrada vira [tempo, coluna * 2 + toca] e volta igual", () => {
  const entradas: [number, number, number][] = [
    [1000, 0, 1],
    [1100, 0, 0],
    [1200, 17, 1],
  ];
  const lote = entradasParaOLoteDoMania(entradas);
  expect(lote).toEqual([
    [1000, 1],
    [1100, 0],
    [1200, 35],
  ]);
  expect(entradasDoLoteDoMania(lote)).toEqual(entradas);
});

const mapa = { titulo: "Música", artista: "Banda", dificuldade: "Insano", teclas: 7, hash: "a".repeat(32), beatmapId: 42 };

it("o estado tocando leva o mapa, as teclas no lugar do instrumento e o modo", () => {
  expect(estadoTocandoNoMania(mapa, true)).toEqual({
    tipo: "tocando",
    musica: `osu:${"a".repeat(32)}`,
    titulo: "Música",
    artista: "Banda",
    dificuldade: "Insano",
    instrumento: "7K",
    transmitindo: true,
    modo: "mania",
  });
});

it("o início da transmissão leva o hash, os mods e a semente", () => {
  expect(partidaParaTransmitirNoMania(mapa, 64, 99)).toEqual({
    musica: `osu:${"a".repeat(32)}`,
    dificuldade: "Insano",
    instrumento: "7K",
    hashDoChart: "a".repeat(32),
    semFalha: false,
    velocidade: 1,
    modo: "mania",
    mods: 64,
    semente: 99,
  });
});
