import { invoke, isTauri } from "@tauri-apps/api/core";
import { bloquearTeclasDoSistema, ehAtalhoDoNavegador } from "./teclado";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => {}), isTauri: vi.fn(() => true) }));

const tecla = (code: string, extra: Partial<KeyboardEventInit> = {}) => new KeyboardEvent("keydown", { code, ...extra });

beforeEach(() => vi.clearAllMocks());

describe("ehAtalhoDoNavegador", () => {
  it("segura recarregar, imprimir, ferramentas e zoom", () => {
    for (const evento of [
      tecla("F5"),
      tecla("F12"),
      tecla("KeyR", { ctrlKey: true }),
      tecla("KeyP", { ctrlKey: true }),
      tecla("KeyI", { ctrlKey: true, shiftKey: true }),
      tecla("Equal", { ctrlKey: true }),
      tecla("Minus", { ctrlKey: true }),
      tecla("Digit0", { ctrlKey: true }),
      tecla("NumpadAdd", { ctrlKey: true }),
    ]) {
      expect(ehAtalhoDoNavegador(evento), evento.code).toBe(true);
    }
  });

  it("deixa passar as teclas do jogo, o Esc da pausa e o F11 da tela cheia", () => {
    for (const code of ["KeyA", "KeyR", "KeyP", "Space", "Enter", "Escape", "F11", "Digit0"]) {
      expect(ehAtalhoDoNavegador(tecla(code)), code).toBe(false);
    }
  });
});

describe("bloquearTeclasDoSistema", () => {
  it("pede ao app nativo para ligar e desligar", async () => {
    await bloquearTeclasDoSistema(true);
    await bloquearTeclasDoSistema(false);
    expect(invoke).toHaveBeenNthCalledWith(1, "teclado_bloquear", { ligar: true });
    expect(invoke).toHaveBeenNthCalledWith(2, "teclado_bloquear", { ligar: false });
  });

  it("no navegador do celular não faz nada", async () => {
    vi.mocked(isTauri).mockReturnValueOnce(false);
    await bloquearTeclasDoSistema(true);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("um erro do app nativo não derruba a partida", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("sem permissão"));
    await expect(bloquearTeclasDoSistema(true)).resolves.toBeUndefined();
  });
});
