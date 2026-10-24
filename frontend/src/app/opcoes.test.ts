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

  it("leva para a partida se o personagem aparece e se o FPS é mostrado", () => {
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, personagem3d: false, mostrarFps: true })).toMatchObject({ personagem: false, mostrarFps: true });
    expect(opcoesDaPartida(CONFIGURACOES_PADRAO)).toMatchObject({ personagem: true, mostrarFps: false });
  });

  it("leva a qualidade do palco, que começa na média", () => {
    expect(opcoesDaPartida(CONFIGURACOES_PADRAO).qualidadeDoPalco).toBe("media");
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, qualidadeDoPalco: "leve" }).qualidadeDoPalco).toBe("leve");
  });

  it("leva o modo competitivo", () => {
    expect(opcoesDaPartida(CONFIGURACOES_PADRAO).modoCompetitivo).toBe(false);
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, modoCompetitivo: true }).modoCompetitivo).toBe(true);
  });
});
