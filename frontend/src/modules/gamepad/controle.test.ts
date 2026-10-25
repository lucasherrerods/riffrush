import { BOTAO_DA_ESTRELA_PADRAO, BOTOES, BOTOES_DOS_TRASTES_PADRAO } from "./mapeamento";
import { capturarBotao, iniciarControle } from "./controle";
import { dispositivoAtual, registrarUso } from "./dispositivo";

function controleFalso() {
  const botoes = Array.from({ length: 17 }, () => ({ pressed: false }));
  const eixos = [0, 0, 0, 0];
  vi.stubGlobal("navigator", { ...navigator, getGamepads: () => [{ buttons: botoes, axes: eixos }] });
  return { botoes, eixos };
}

function ouvirTeclas() {
  const teclas: string[] = [];
  const ouvir = (e: KeyboardEvent) => teclas.push(`${e.type}:${e.code}`);
  window.addEventListener("keydown", ouvir);
  window.addEventListener("keyup", ouvir);
  return {
    teclas,
    parar() {
      window.removeEventListener("keydown", ouvir);
      window.removeEventListener("keyup", ouvir);
    },
  };
}

const MAPA = { teclas: ["KeyA", "KeyS", "KeyJ", "KeyK", "KeyL"], teclaDaEstrela: "Space", botoesDoControle: BOTOES_DOS_TRASTES_PADRAO, botaoDaEstrela: BOTAO_DA_ESTRELA_PADRAO };

const proximoQuadro = () => vi.advanceTimersByTime(5);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("iniciarControle", () => {
  it("transforma os botões do controle em teclas na janela", () => {
    const { botoes } = controleFalso();
    const ouvinte = ouvirTeclas();
    const parar = iniciarControle({ modo: () => "jogo", mapa: () => MAPA });

    botoes[BOTOES.RT].pressed = true;
    proximoQuadro();
    botoes[BOTOES.RT].pressed = false;
    proximoQuadro();

    expect(ouvinte.teclas).toEqual(["keydown:KeyK", "keyup:KeyK"]);
    parar();
    ouvinte.parar();
  });

  it("o analógico navega nos menus e solta a seta ao voltar para o centro", () => {
    const { eixos } = controleFalso();
    const ouvinte = ouvirTeclas();
    const parar = iniciarControle({ modo: () => "menu", mapa: () => MAPA });

    eixos[1] = 0.9;
    proximoQuadro();
    eixos[1] = 0;
    proximoQuadro();

    expect(ouvinte.teclas).toEqual(["keydown:ArrowDown", "keyup:ArrowDown"]);
    parar();
    ouvinte.parar();
  });

  it("segurar uma direção no menu repete a seta, para correr pelas listas", () => {
    const { eixos } = controleFalso();
    const ouvinte = ouvirTeclas();
    const parar = iniciarControle({ modo: () => "menu", mapa: () => MAPA });

    eixos[1] = 0.9;
    vi.advanceTimersByTime(1000);

    const descidas = ouvinte.teclas.filter((t) => t === "keydown:ArrowDown").length;
    expect(descidas).toBeGreaterThan(3);
    expect(descidas).toBeLessThan(10);
    parar();
    ouvinte.parar();
  });

  it("no jogo, segurar o direcional não repete a palhetada", () => {
    const { botoes } = controleFalso();
    const ouvinte = ouvirTeclas();
    const parar = iniciarControle({ modo: () => "jogo", mapa: () => MAPA });

    botoes[BOTOES.BAIXO].pressed = true;
    vi.advanceTimersByTime(1000);

    expect(ouvinte.teclas.filter((t) => t === "keydown:ArrowDown")).toHaveLength(1);
    parar();
    ouvinte.parar();
  });

  it("apertar um botão avisa que o jogador está usando o controle", () => {
    registrarUso("teclado");
    const { botoes } = controleFalso();
    const parar = iniciarControle({ modo: () => "menu", mapa: () => ({ ...MAPA, teclas: [] }) });

    botoes[BOTOES.A].pressed = true;
    proximoQuadro();

    expect(dispositivoAtual()).toBe("controle");
    parar();
  });

  it("funciona sem controle conectado", () => {
    vi.stubGlobal("navigator", { ...navigator, getGamepads: () => [null] });
    const parar = iniciarControle({ modo: () => "menu", mapa: () => ({ ...MAPA, teclas: [] }) });
    expect(() => proximoQuadro()).not.toThrow();
    parar();
  });

  it("capturando, o próximo botão vai para a escolha e não vira tecla", () => {
    const { botoes } = controleFalso();
    const ouvinte = ouvirTeclas();
    const parar = iniciarControle({ modo: () => "menu", mapa: () => MAPA });
    const escolher = vi.fn();
    capturarBotao(escolher);

    // O direcional não pode ser escolhido: continua navegando.
    botoes[BOTOES.BAIXO].pressed = true;
    proximoQuadro();
    botoes[BOTOES.A].pressed = true;
    proximoQuadro();
    botoes[BOTOES.A].pressed = false;
    proximoQuadro();

    expect(escolher).toHaveBeenCalledExactlyOnceWith(BOTOES.A);
    expect(ouvinte.teclas).not.toContain("keydown:Enter");
    parar();
    ouvinte.parar();
  });

  it("cancelar a captura volta a transformar os botões em teclas", () => {
    const { botoes } = controleFalso();
    const ouvinte = ouvirTeclas();
    const parar = iniciarControle({ modo: () => "menu", mapa: () => MAPA });
    const cancelar = capturarBotao(vi.fn());

    cancelar();
    botoes[BOTOES.A].pressed = true;
    proximoQuadro();

    expect(ouvinte.teclas).toContain("keydown:Enter");
    parar();
    ouvinte.parar();
  });
});
