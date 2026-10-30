import { modoDoF11, planoDaJanela, resolucaoDaJanela, resolucoesDisponiveis } from "./modoDeJanela";

const monitor1080 = { x: 0, y: 0, largura: 1920, altura: 1080 };

describe("resolucoesDisponiveis", () => {
  it("só oferece o que cabe no monitor", () => {
    expect(resolucoesDisponiveis({ largura: 1600, altura: 900 }).map((r) => r.id)).toEqual(["1280x720", "1366x768", "1600x900"]);
  });

  it("num monitor menor que todas, ainda oferece a menor", () => {
    expect(resolucoesDisponiveis({ largura: 1024, altura: 600 }).map((r) => r.id)).toEqual(["1280x720"]);
  });
});

describe("resolucaoDaJanela", () => {
  it("usa a salva quando cabe", () => {
    expect(resolucaoDaJanela("1600x900", monitor1080)).toEqual({ largura: 1600, altura: 900 });
  });

  it("troca a salva que não cabe mais pela maior que cabe", () => {
    expect(resolucaoDaJanela("2560x1440", monitor1080)).toEqual({ largura: 1920, altura: 1080 });
  });

  it("sem resolução salva, começa em 1280x720", () => {
    expect(resolucaoDaJanela(null, monitor1080)).toEqual({ largura: 1280, altura: 720 });
  });
});

describe("planoDaJanela", () => {
  it("sem borda cobre o monitor atual, mesmo fora da origem", () => {
    const segundo = { x: 1920, y: -200, largura: 2560, altura: 1440 };
    expect(planoDaJanela("sem-borda", null, segundo)).toEqual({
      telaCheia: false,
      bordas: false,
      posicao: { x: 1920, y: -200 },
      tamanho: { largura: 2560, altura: 1440 },
      centralizar: false,
    });
  });

  it("tela cheia é a do sistema, com bordas de volta para quando sair", () => {
    expect(planoDaJanela("tela-cheia", "1600x900", monitor1080)).toEqual({ telaCheia: true, bordas: true, centralizar: false });
  });

  it("janela usa a resolução e fica no centro", () => {
    expect(planoDaJanela("janela", "1600x900", monitor1080)).toEqual({ telaCheia: false, bordas: true, tamanho: { largura: 1600, altura: 900 }, centralizar: true });
  });

  it("F11 alterna entre janela e tela cheia", () => {
    expect(modoDoF11("janela")).toBe("tela-cheia");
    expect(modoDoF11("tela-cheia")).toBe("janela");
    expect(modoDoF11("sem-borda")).toBe("janela");
  });

  it("sem monitor ou sem resolução, a janela só tira a tela cheia", () => {
    expect(planoDaJanela("janela", "1600x900", null)).toEqual({ telaCheia: false, bordas: true, centralizar: false });
    expect(planoDaJanela("janela", null, monitor1080)).toEqual({ telaCheia: false, bordas: true, centralizar: false });
    expect(planoDaJanela("sem-borda", null, null)).toEqual({ telaCheia: false, bordas: false, centralizar: false });
  });
});
