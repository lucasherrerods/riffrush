import { CONFIGURACOES_PADRAO, antecedenciaDasNotas, carregarConfiguracoes, nomeDaTecla, salvarConfiguracoes, trocarBotao, trocarTecla } from "./configuracoes";

beforeEach(() => localStorage.clear());

describe("carregarConfiguracoes", () => {
  it("usa o padrão quando não há nada salvo", () => {
    expect(carregarConfiguracoes()).toEqual(CONFIGURACOES_PADRAO);
  });

  it("devolve o que foi salvo", () => {
    salvarConfiguracoes({ ...CONFIGURACOES_PADRAO, velocidade: 9 });
    expect(carregarConfiguracoes().velocidade).toBe(9);
  });

  it("completa com o padrão as opções que não existiam quando foi salvo", () => {
    localStorage.setItem("riffrush.configuracoes", JSON.stringify({ velocidade: 3 }));
    expect(carregarConfiguracoes()).toEqual({ ...CONFIGURACOES_PADRAO, velocidade: 3 });
  });

  it("quem salvou antes da nota aberta ganha a tecla e o botão dela, sem perder os trastes escolhidos", () => {
    localStorage.setItem("riffrush.configuracoes", JSON.stringify({ teclas: ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT"], botoesDoControle: [1, 2, 3, 4, 5] }));
    const carregadas = carregarConfiguracoes();
    expect(carregadas.teclas).toEqual(["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", CONFIGURACOES_PADRAO.teclas[5]]);
    expect(carregadas.botoesDoControle).toEqual([1, 2, 3, 4, 5, CONFIGURACOES_PADRAO.botoesDoControle[5]]);
  });

  it("ignora dados corrompidos", () => {
    localStorage.setItem("riffrush.configuracoes", "{quebrado");
    expect(carregarConfiguracoes()).toEqual(CONFIGURACOES_PADRAO);
  });
});

describe("trocarTecla", () => {
  it("troca a tecla do traste", () => {
    expect(trocarTecla(CONFIGURACOES_PADRAO, 0, "KeyQ").teclas[0]).toBe("KeyQ");
  });

  it("se a tecla já estava em outro traste, os dois trocam de lugar", () => {
    const { teclas } = trocarTecla(CONFIGURACOES_PADRAO, 0, "KeyS");
    expect(teclas.slice(0, 2)).toEqual(["KeyS", "KeyA"]);
  });

  it("o índice 5 é a nota aberta, e ela troca de lugar com um traste como os outros", () => {
    expect(trocarTecla(CONFIGURACOES_PADRAO, 5, "KeyE").teclas[5]).toBe("KeyE");
    expect(trocarTecla(CONFIGURACOES_PADRAO, 5, "KeyA").teclas.slice(0, 1)).toEqual([CONFIGURACOES_PADRAO.teclas[5]]);
  });

  it("o índice 6 é a tecla do star power", () => {
    expect(trocarTecla(CONFIGURACOES_PADRAO, 6, "KeyE").teclaDaEstrela).toBe("KeyE");
  });
});

describe("trocarBotao", () => {
  // Padrão: LT(6), LB(4), RB(5), RT(7) e A(0) nos trastes, X(2) na aberta, Select(8) no star power.
  it("troca o botão do traste no controle sem mexer nas teclas", () => {
    const trocada = trocarBotao(CONFIGURACOES_PADRAO, 0, 1);
    expect(trocada.botoesDoControle).toEqual([1, 4, 5, 7, 0, 2]);
    expect(trocada.teclas).toEqual(CONFIGURACOES_PADRAO.teclas);
  });

  it("se o botão já estava em outro traste, os dois trocam de lugar", () => {
    expect(trocarBotao(CONFIGURACOES_PADRAO, 0, 4).botoesDoControle).toEqual([4, 6, 5, 7, 0, 2]);
  });

  it("o índice 6 é o star power, e ele também troca com um traste", () => {
    expect(trocarBotao(CONFIGURACOES_PADRAO, 6, 3).botaoDaEstrela).toBe(3);
    const comTraste = trocarBotao(CONFIGURACOES_PADRAO, 6, 6);
    expect(comTraste.botaoDaEstrela).toBe(6);
    expect(comTraste.botoesDoControle[0]).toBe(8);
  });
});

describe("nomeDaTecla", () => {
  it.each([
    ["KeyA", "A"],
    ["Digit7", "7"],
    ["Space", "Espaço"],
    ["ArrowLeft", "Seta Esq"],
    ["ShiftRight", "Shift Dir"],
    ["Numpad4", "Num 4"],
  ])("%s vira %s", (codigo, nome) => {
    expect(nomeDaTecla(codigo)).toBe(nome);
  });
});

describe("antecedenciaDasNotas", () => {
  it("quanto maior a velocidade, menos tempo a nota fica na tela", () => {
    expect(antecedenciaDasNotas(10)).toBeLessThan(antecedenciaDasNotas(1));
  });

  it("vai de cerca de 3 s (velocidade 1) a 0,9 s (velocidade 10), com quase 1,8 s no padrão", () => {
    expect(antecedenciaDasNotas(1)).toBeCloseTo(2.97);
    expect(antecedenciaDasNotas(CONFIGURACOES_PADRAO.velocidade)).toBeCloseTo(1.82);
    expect(antecedenciaDasNotas(10)).toBeCloseTo(0.9);
  });
});

describe("volume do player", () => {
  it("a música dos menus começa baixa, inclusive em configurações salvas antes", () => {
    expect(CONFIGURACOES_PADRAO.volumeDoPlayer).toBeLessThan(CONFIGURACOES_PADRAO.volumeDaMusica);
    localStorage.setItem("riffrush.configuracoes", JSON.stringify({ volumeDaMusica: 0.8 }));
    expect(carregarConfiguracoes().volumeDoPlayer).toBe(CONFIGURACOES_PADRAO.volumeDoPlayer);
  });
});

describe("personagem e FPS", () => {
  it("por padrão o personagem 3D aparece e o FPS fica escondido, inclusive em configurações salvas antes", () => {
    expect(CONFIGURACOES_PADRAO.personagem3d).toBe(true);
    expect(CONFIGURACOES_PADRAO.mostrarFps).toBe(false);
    localStorage.setItem("riffrush.configuracoes", JSON.stringify({ velocidade: 3 }));
    expect(carregarConfiguracoes()).toMatchObject({ velocidade: 3, personagem3d: true, mostrarFps: false });
  });

  it("o modo competitivo começa ligado, inclusive para quem já tinha configurações salvas", () => {
    expect(CONFIGURACOES_PADRAO.modoCompetitivo).toBe(true);
    localStorage.setItem("riffrush.configuracoes", JSON.stringify({ velocidade: 3 }));
    expect(carregarConfiguracoes().modoCompetitivo).toBe(true);
  });
});
