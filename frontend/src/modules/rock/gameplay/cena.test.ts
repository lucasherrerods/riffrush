import { cenaDaPartida } from "./cena";

const normal = { modoCompetitivo: false, efeitos: true, personagem: true, comWebGL: true, estreita: false };

describe("cenaDaPartida", () => {
  it("no modo normal mostra palco, personagem e vídeo", () => {
    expect(cenaDaPartida(normal)).toEqual({ palco: true, personagem: true, video: true });
  });

  it("no modo competitivo fica só a pista e o placar", () => {
    expect(cenaDaPartida({ ...normal, modoCompetitivo: true })).toEqual({ palco: false, personagem: false, video: false });
  });

  it("sem WebGL ou sem efeitos, o palco sai mas o personagem fica no HUD", () => {
    for (const mudanca of [{ comWebGL: false }, { efeitos: false }]) {
      expect(cenaDaPartida({ ...normal, ...mudanca })).toEqual({ palco: false, personagem: true, video: true });
    }
  });

  it("no celular o personagem sai junto com o palco, mesmo ligado nas configurações", () => {
    expect(cenaDaPartida({ ...normal, estreita: true })).toEqual({ palco: false, personagem: false, video: true });
  });

  it("com o personagem desligado, ele some do palco e do HUD", () => {
    expect(cenaDaPartida({ ...normal, personagem: false })).toMatchObject({ palco: true, personagem: false });
  });
});
