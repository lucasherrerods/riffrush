import { descreverEstado } from "./descrever";

describe("descreverEstado", () => {
  it("diz se a pessoa está numa sala, online ou na LAN, e quantos jogadores tem", () => {
    expect(descreverEstado({ tipo: "multiplayer" })).toBe("No multiplayer");
    expect(descreverEstado({ tipo: "multiplayer", sala: { jogadores: 2, online: true } })).toBe("Em sala online · 2 jogadores");
    expect(descreverEstado({ tipo: "multiplayer", sala: { jogadores: 1, online: false } })).toBe("Em sala na LAN · 1 jogador");
  });
});
