import { OPCOES_DOS_JEITOS, rankingDoJeito } from "./jeitos";

describe("rankings dos jeitos de jogar", () => {
  it("tapping e gamepad caem no mesmo ranking, e a palhetada no próprio", () => {
    expect(rankingDoJeito("tapping")).toBe(rankingDoJeito("gamepad"));
    expect(rankingDoJeito("palhetada")).toBe("palhetada");
  });

  it("oferece só um ranking para tapping e gamepad", () => {
    expect(OPCOES_DOS_JEITOS.map((o) => o.rotulo)).toEqual(["Tapping e Gamepad", "Palhetada"]);
    expect(OPCOES_DOS_JEITOS.map((o) => o.id)).toEqual(["gamepad", "palhetada"]);
  });
});
