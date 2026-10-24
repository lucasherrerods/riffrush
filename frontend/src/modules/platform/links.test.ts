import { openUrl } from "@tauri-apps/plugin-opener";
import { abrirLink } from "./links";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));

const URL_DO_PROJETO = "https://github.com/lucasherrerods/riffrush";

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe("abrirLink", () => {
  it("no app do PC, abre no navegador do sistema", async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    await abrirLink(URL_DO_PROJETO);
    expect(openUrl).toHaveBeenCalledWith(URL_DO_PROJETO);
  });

  it("no navegador, abre numa aba nova", async () => {
    const abrir = vi.spyOn(window, "open").mockImplementation(() => null);
    await abrirLink(URL_DO_PROJETO);
    expect(abrir).toHaveBeenCalledWith(URL_DO_PROJETO, "_blank", "noopener,noreferrer");
    expect(openUrl).not.toHaveBeenCalled();
  });
});
