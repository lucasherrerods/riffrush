import { getCurrentWindow } from "@tauri-apps/api/window";
import { definirTelaCheia, estaEmTelaCheia, fecharJanela } from "./janela";

vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));

const janelaNativa = { setFullscreen: vi.fn(), isFullscreen: vi.fn(async () => true), close: vi.fn() };
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
