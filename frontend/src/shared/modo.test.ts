import { modoDoEndereco } from "./modo";

describe("modoDoEndereco", () => {
  // O QR code da sala do Mania leva o modo: o celular abre direto no jogo certo.
  it("lê o modo do endereço que o celular abriu", () => {
    expect(modoDoEndereco("?modo=mania")).toBe("mania");
    expect(modoDoEndereco("?outro=1&modo=rock")).toBe("rock");
  });

  it("sem modo conhecido no endereço, não decide nada", () => {
    expect(modoDoEndereco("")).toBeUndefined();
    expect(modoDoEndereco("?modo=xyz")).toBeUndefined();
  });
});
