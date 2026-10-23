import { CONFIGURACOES_PADRAO, antecedenciaDasNotas, carregarConfiguracoes, nomeDaTecla, salvarConfiguracoes, trocarTecla } from "./configuracoes";

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

  it("o índice 5 é a tecla do star power", () => {
    expect(trocarTecla(CONFIGURACOES_PADRAO, 5, "KeyE").teclaDaEstrela).toBe("KeyE");
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

  it("vai de cerca de 2,4 s (velocidade 1) a 0,7 s (velocidade 10)", () => {
    expect(antecedenciaDasNotas(1)).toBeCloseTo(2.41);
    expect(antecedenciaDasNotas(10)).toBeCloseTo(0.7);
  });
});

describe("personagem e FPS", () => {
  it("por padrão o personagem 3D aparece e o FPS fica escondido, inclusive em configurações salvas antes", () => {
    expect(CONFIGURACOES_PADRAO.personagem3d).toBe(true);
    expect(CONFIGURACOES_PADRAO.mostrarFps).toBe(false);
    localStorage.setItem("riffrush.configuracoes", JSON.stringify({ velocidade: 3 }));
    expect(carregarConfiguracoes()).toMatchObject({ velocidade: 3, personagem3d: true, mostrarFps: false });
  });
});
