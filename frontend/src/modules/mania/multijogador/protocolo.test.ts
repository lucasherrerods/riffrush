import { lerEscolhaDoMania, protocoloDoMania, type MapaNaRede } from "./protocolo";

const doOsu: MapaNaRede = { tipo: "osu", beatmapsetId: 123, hash: "abc", titulo: "Música", artista: "Banda", dificuldade: "Hard", teclas: 4 };

describe("escolha do Mania na rede", () => {
  it("lê o mapa e os mods que o host mandou", () => {
    expect(lerEscolhaDoMania({ modo: "mania", mapa: doOsu, mods: 64 })).toEqual({ mapa: doOsu, mods: 64 });
  });

  it("a sala sem mapa ainda vale: o host não escolheu nada", () => {
    expect(lerEscolhaDoMania({ modo: "mania", mapa: null, mods: 0 })).toEqual({ mapa: null, mods: 0 });
  });

  it("mensagem do Rock, sem modo, não é do Mania", () => {
    expect(lerEscolhaDoMania({ mapa: doOsu, mods: 0 })).toBeNull();
  });

  it("recusa mapa estragado e mods fora da faixa", () => {
    expect(lerEscolhaDoMania({ modo: "mania", mapa: { ...doOsu, beatmapsetId: -1 }, mods: 0 })).toBeNull();
    expect(lerEscolhaDoMania({ modo: "mania", mapa: { ...doOsu, hash: 3 } as unknown as MapaNaRede, mods: 0 })).toBeNull();
    expect(lerEscolhaDoMania({ modo: "mania", mapa: doOsu, mods: -5 })).toBeNull();
    expect(lerEscolhaDoMania({ modo: "mania", mapa: { ...doOsu, tipo: "qualquer" } as unknown as MapaNaRede, mods: 0 })).toBeNull();
  });

  it("o pronto vale pela dificuldade escolhida", () => {
    expect(protocoloDoMania.modo.idDaEscolha({ mapa: doOsu, mods: 0 })).toBe("abc");
    expect(protocoloDoMania.modo.idDaEscolha({ mapa: null, mods: 0 })).toBe("");
  });

  it("a mensagem da sala leva o modo, para o Rock não abrir a sala do Mania", () => {
    expect(protocoloDoMania.modo.escreverEscolha({ mapa: doOsu, mods: 0 })).toEqual({ modo: "mania", mapa: doOsu, mods: 0 });
  });
});
