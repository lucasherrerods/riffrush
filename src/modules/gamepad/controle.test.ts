import { BOTOES } from "./mapeamento";
import { iniciarControle } from "./controle";

function controleFalso() {
  const botoes = Array.from({ length: 17 }, () => ({ pressed: false }));
  vi.stubGlobal("navigator", { ...navigator, getGamepads: () => [{ buttons: botoes }] });
  return botoes;
}

const proximoQuadro = () => vi.advanceTimersByTime(5);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("iniciarControle", () => {
  it("transforma os botões do controle em teclas na janela", () => {
    const botoes = controleFalso();
    const teclas: string[] = [];
    const ouvir = (e: KeyboardEvent) => teclas.push(`${e.type}:${e.code}`);
    window.addEventListener("keydown", ouvir);
    window.addEventListener("keyup", ouvir);
    const parar = iniciarControle({ modo: () => "jogo", mapa: () => ({ teclas: ["KeyA", "KeyS", "KeyJ", "KeyK", "KeyL"], teclaDaEstrela: "Space" }) });

    botoes[BOTOES.RB].pressed = true;
    proximoQuadro();
    botoes[BOTOES.RB].pressed = false;
    proximoQuadro();

    expect(teclas).toEqual(["keydown:KeyK", "keyup:KeyK"]);
    parar();
    window.removeEventListener("keydown", ouvir);
    window.removeEventListener("keyup", ouvir);
  });

  it("funciona sem controle conectado", () => {
    vi.stubGlobal("navigator", { ...navigator, getGamepads: () => [null] });
    const parar = iniciarControle({ modo: () => "menu", mapa: () => ({ teclas: [], teclaDaEstrela: "Space" }) });
    expect(() => proximoQuadro()).not.toThrow();
    parar();
  });
});
