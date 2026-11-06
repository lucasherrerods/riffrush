import { CONFIGURACOES_PADRAO } from "@/modules/settings";
import { mesmasOpcoes, opcoesDaPartida } from "./opcoes";

describe("opcoesDaPartida", () => {
  it("leva a skin escolhida, e a clássica se ela não existe mais", () => {
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, skinDaPista: "neon" }).skin.id).toBe("neon");
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, skinDaPista: "highway:apagada" }).skin.id).toBe("classica");
  });

  it("leva a caçapa escolhida, independente da pista", () => {
    const opcoes = opcoesDaPartida({ ...CONFIGURACOES_PADRAO, skinDaPista: "neon", formatoDaCacapa: "hexagonal", coresDaCacapa: "pastel", brilhoDaCacapa: 0.5, contornoForte: true });
    expect(opcoes.skin.id).toBe("neon");
    expect(opcoes.cacapa).toMatchObject({ formato: "hexagonal", brilho: 0.5, contornoForte: true });
  });

  it("a mesma skin não faz as opções mudarem", () => {
    expect(mesmasOpcoes(opcoesDaPartida(CONFIGURACOES_PADRAO), opcoesDaPartida(CONFIGURACOES_PADRAO))).toBe(true);
  });

  it("traduz as configurações do jogador para a partida", () => {
    const opcoes = opcoesDaPartida({ ...CONFIGURACOES_PADRAO, teclaDaEstrela: "KeyE", bot: true });
    expect(opcoes).toMatchObject({
      teclas: CONFIGURACOES_PADRAO.teclas,
      teclaDaEstrela: "KeyE",
      rotuloDaTeclaDaEstrela: "E",
      bot: true,
    });
    // A velocidade é a mesma para todos: a 8,5, com as notas a menos de um segundo na tela.
    expect(opcoes.antecedencia).toBeCloseTo(0.985);
  });

  it("leva para a partida se o personagem aparece e se o FPS é mostrado", () => {
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, personagem3d: false, mostrarFps: true })).toMatchObject({ personagem: false, mostrarFps: true });
    expect(opcoesDaPartida(CONFIGURACOES_PADRAO)).toMatchObject({ personagem: true, mostrarFps: false });
  });

  it("leva o bloqueio das teclas do sistema, que começa ligado", () => {
    expect(opcoesDaPartida(CONFIGURACOES_PADRAO).bloquearAtalhos).toBe(true);
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, bloquearAtalhos: false }).bloquearAtalhos).toBe(false);
  });

  it("leva a escala de renderização da pista, que começa em 100%", () => {
    expect(opcoesDaPartida(CONFIGURACOES_PADRAO).escalaDeRenderizacao).toBe(1);
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, escalaDeRenderizacao: 0.5 }).escalaDeRenderizacao).toBe(0.5);
  });

  it("leva a qualidade do palco, que começa na média", () => {
    expect(opcoesDaPartida(CONFIGURACOES_PADRAO).qualidadeDoPalco).toBe("media");
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, qualidadeDoPalco: "leve" }).qualidadeDoPalco).toBe("leve");
  });

  it("leva o jeito de jogar e a tecla da palheta", () => {
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, jeitoDeJogar: "palhetada", teclaDaPalheta: "KeyP" }, false)).toMatchObject({ jeitoDeJogar: "palhetada", teclaDaPalheta: "KeyP" });
  });

  it("no celular é sempre tapping: não há palheta na tela de toque", () => {
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, jeitoDeJogar: "palhetada" }, true).jeitoDeJogar).toBe("tapping");
  });

  it("com a nota aberta desligada, a partida joga sem ela", () => {
    expect(opcoesDaPartida(CONFIGURACOES_PADRAO).semAberta).toBe(false);
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, notaAberta: false }).semAberta).toBe(true);
  });

  it("leva o modo competitivo", () => {
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, modoCompetitivo: true }).modoCompetitivo).toBe(true);
    expect(opcoesDaPartida({ ...CONFIGURACOES_PADRAO, modoCompetitivo: false }).modoCompetitivo).toBe(false);
  });
});

describe("mesmasOpcoes", () => {
  it("compara campo a campo, e listas item a item", () => {
    const base = opcoesDaPartida(CONFIGURACOES_PADRAO);
    expect(mesmasOpcoes(base, opcoesDaPartida({ ...CONFIGURACOES_PADRAO, volumeGeral: 0.2 }))).toBe(true);
    expect(mesmasOpcoes(base, { ...base, teclas: [...base.teclas] })).toBe(true);
    expect(mesmasOpcoes(base, { ...base, teclas: ["KeyQ", ...base.teclas.slice(1)] })).toBe(false);
    expect(mesmasOpcoes(base, { ...base, volumeDaMusica: 0.1 })).toBe(false);
    expect(mesmasOpcoes(base, { ...base, rotulosDosTrastes: ["A"] })).toBe(false);
  });
});
