import { CONFIGURACOES_PADRAO } from "@/modules/settings";
import { opcoesDaPartida } from "./opcoes";

describe("opcoesDaPartida", () => {
  it("traduz as configurações do jogador para a partida", () => {
    const opcoes = opcoesDaPartida({ ...CONFIGURACOES_PADRAO, velocidade: 10, teclaDaEstrela: "KeyE", bot: true });
    expect(opcoes).toMatchObject({
      teclas: CONFIGURACOES_PADRAO.teclas,
      teclaDaEstrela: "KeyE",
      rotuloDaTeclaDaEstrela: "E",
      bot: true,
    });
    expect(opcoes.antecedencia).toBeCloseTo(0.7);
  });
});
