import { cardDoPersonagem, type DefinicaoDePersonagem } from "./catalogo";

const skin = (id: string, card?: string) => ({ id, rotulo: id, arquivo: `/modelos/atores/${id}`, tipo: "video" as const, card });

describe("cardDoPersonagem", () => {
  const roqueiro: DefinicaoDePersonagem = { id: "r", rotulo: "R", instrumento: "guitarra", skins: [skin("a", "/a.webp"), skin("b", "/b.webp"), skin("c")] };

  it("usa o card da skin escolhida", () => {
    expect(cardDoPersonagem(roqueiro, "b")).toBe("/b.webp");
  });

  it("skin sem card, ou sem skin escolhida, usa o card da primeira skin", () => {
    expect(cardDoPersonagem(roqueiro, "c")).toBe("/a.webp");
    expect(cardDoPersonagem(roqueiro)).toBe("/a.webp");
  });

  it("personagem sem card nenhum fica sem card", () => {
    expect(cardDoPersonagem({ ...roqueiro, skins: [skin("c")] })).toBeNull();
  });
});
