import { OPCOES_PADRAO_DA_PARTIDA, reiniciaAPartida } from "./opcoesDaPartida";

describe("reiniciaAPartida", () => {
  it("alternar o modo competitivo (Shift+Tab) não recomeça a partida", () => {
    expect(reiniciaAPartida(OPCOES_PADRAO_DA_PARTIDA, { ...OPCOES_PADRAO_DA_PARTIDA, modoCompetitivo: true })).toBe(false);
  });

  it("trocar uma opção que a partida usa a recomeça", () => {
    expect(reiniciaAPartida(OPCOES_PADRAO_DA_PARTIDA, { ...OPCOES_PADRAO_DA_PARTIDA, bot: true })).toBe(true);
  });
});
