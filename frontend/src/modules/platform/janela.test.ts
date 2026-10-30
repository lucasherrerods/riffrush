import { getCurrentWindow } from "@tauri-apps/api/window";
import { aplicarModoDeJanela, definirTelaCheia, ehJanelaNativa, estaEmTelaCheia, fecharJanela } from "./janela";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(),
  currentMonitor: vi.fn(async () => ({ position: { x: 1920, y: 0 }, size: { width: 2560, height: 1440 } })),
  PhysicalSize: class {
    constructor(public width: number, public height: number) {}
  },
  PhysicalPosition: class {
    constructor(public x: number, public y: number) {}
  },
}));

const janelaNativa = {
  setFullscreen: vi.fn(),
  isFullscreen: vi.fn(async () => true),
  close: vi.fn(),
  setDecorations: vi.fn(),
  setSize: vi.fn(),
  setPosition: vi.fn(),
  center: vi.fn(),
};
const foraDoTauri = () =>
  vi.mocked(getCurrentWindow).mockImplementation(() => {
    throw new TypeError("Cannot read properties of undefined (reading 'metadata')");
  });
const dentroDoTauri = () => vi.mocked(getCurrentWindow).mockReturnValue(janelaNativa as never);

beforeEach(() => vi.clearAllMocks());

describe("fora do Tauri (navegador do celular)", () => {
  // Bug do projeto antigo: a tela de configurações quebrava porque getCurrentWindow lança erro fora do Tauri.
  it("liga a tela cheia pelo navegador sem quebrar", async () => {
    foraDoTauri();
    const pedir = vi.fn(async () => {});
    document.documentElement.requestFullscreen = pedir;
    await definirTelaCheia(true);
    expect(pedir).toHaveBeenCalled();
  });

  it("descobre a tela cheia pelo documento", async () => {
    foraDoTauri();
    expect(await estaEmTelaCheia()).toBe(false);
  });

  it("fechar o jogo fecha a aba", async () => {
    foraDoTauri();
    const fechar = vi.spyOn(window, "close").mockImplementation(() => {});
    await fecharJanela();
    expect(fechar).toHaveBeenCalled();
  });
});

describe("dentro do Tauri", () => {
  it("usa a janela nativa", async () => {
    dentroDoTauri();
    await definirTelaCheia(true);
    expect(janelaNativa.setFullscreen).toHaveBeenCalledWith(true);
    expect(await estaEmTelaCheia()).toBe(true);
    await fecharJanela();
    expect(janelaNativa.close).toHaveBeenCalled();
  });
});

describe("modo de janela", () => {
  it("no navegador não mexe em nada", async () => {
    foraDoTauri();
    expect(ehJanelaNativa()).toBe(false);
    await expect(aplicarModoDeJanela("sem-borda", null)).resolves.toBeUndefined();
  });

  it("sem borda tira as bordas e cobre o monitor atual em pixels físicos", async () => {
    dentroDoTauri();
    expect(ehJanelaNativa()).toBe(true);
    await aplicarModoDeJanela("sem-borda", null);
    expect(janelaNativa.setFullscreen).toHaveBeenCalledWith(false);
    expect(janelaNativa.setDecorations).toHaveBeenCalledWith(false);
    expect(janelaNativa.setSize).toHaveBeenCalledWith({ width: 2560, height: 1440 });
    expect(janelaNativa.setPosition).toHaveBeenCalledWith({ x: 1920, y: 0 });
  });

  it("janela volta as bordas, usa a resolução e centraliza", async () => {
    dentroDoTauri();
    await aplicarModoDeJanela("janela", "1600x900");
    expect(janelaNativa.setDecorations).toHaveBeenCalledWith(true);
    expect(janelaNativa.setSize).toHaveBeenCalledWith({ width: 1600, height: 900 });
    expect(janelaNativa.center).toHaveBeenCalled();
  });

  it("tela cheia liga a do sistema por último", async () => {
    dentroDoTauri();
    await aplicarModoDeJanela("tela-cheia", null);
    expect(janelaNativa.setFullscreen).toHaveBeenLastCalledWith(true);
    expect(janelaNativa.setSize).not.toHaveBeenCalled();
  });
});
