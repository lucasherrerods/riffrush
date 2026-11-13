import { act, renderHook } from "@testing-library/react";
import { DURACAO_DA_PREVIA_MS, usePrevia, type FonteDaPrevia } from "./usePrevia";

class AudioFalso {
  src = "";
  currentTime = 0;
  volume = 1;
  tocando = false;
  onended: (() => void) | null = null;
  play = vi.fn(async () => {
    this.tocando = true;
  });
  pause = vi.fn(() => {
    this.tocando = false;
  });
  terminar() {
    this.onended?.();
  }
}

function montar(aoMudar = vi.fn()) {
  const audio = new AudioFalso();
  const hook = renderHook(() => usePrevia({ criarAudio: () => audio as unknown as HTMLAudioElement, volume: () => 0.5, aoMudar }));
  return { audio, hook, aoMudar };
}

const fonte = (url: string, liberar = vi.fn()): FonteDaPrevia => ({ url, inicioS: 30, liberar });

describe("usePrevia", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("carrega, toca do ponto pedido e avisa que começou", async () => {
    const { audio, hook, aoMudar } = montar();
    let entregar!: (f: FonteDaPrevia) => void;
    act(() => hook.result.current.alternar("a", () => new Promise((r) => (entregar = r))));
    expect(hook.result.current.estadoDe("a")).toBe("carregando");
    await act(async () => entregar(fonte("blob:a")));
    expect(hook.result.current.estadoDe("a")).toBe("tocando");
    expect(audio.src).toBe("blob:a");
    expect(audio.currentTime).toBe(30);
    expect(audio.volume).toBe(0.5);
    expect(aoMudar).toHaveBeenLastCalledWith(true);
  });

  it("para ao clicar de novo e libera o áudio", async () => {
    const { audio, hook, aoMudar } = montar();
    const liberar = vi.fn();
    await act(async () => hook.result.current.alternar("a", async () => fonte("blob:a", liberar)));
    act(() => hook.result.current.alternar("a", async () => fonte("blob:a")));
    expect(audio.pause).toHaveBeenCalled();
    expect(liberar).toHaveBeenCalled();
    expect(hook.result.current.estadoDe("a")).toBe("parada");
    expect(aoMudar).toHaveBeenLastCalledWith(false);
  });

  it("troca de música sem tocar duas ao mesmo tempo", async () => {
    const { audio, hook } = montar();
    await act(async () => hook.result.current.alternar("a", async () => fonte("blob:a")));
    await act(async () => hook.result.current.alternar("b", async () => fonte("blob:b")));
    expect(hook.result.current.estadoDe("a")).toBe("parada");
    expect(hook.result.current.estadoDe("b")).toBe("tocando");
    expect(audio.src).toBe("blob:b");
  });

  it("ignora uma prévia que chegou depois de o jogador escolher outra", async () => {
    const { audio, hook } = montar();
    let entregarA!: (f: FonteDaPrevia) => void;
    const liberarA = vi.fn();
    act(() => hook.result.current.alternar("a", () => new Promise((r) => (entregarA = r))));
    await act(async () => hook.result.current.alternar("b", async () => fonte("blob:b")));
    await act(async () => entregarA(fonte("blob:a", liberarA)));
    expect(audio.src).toBe("blob:b");
    expect(liberarA).toHaveBeenCalled();
  });

  it("para sozinha depois de um trecho curto ou no fim do áudio", async () => {
    const { audio, hook } = montar();
    await act(async () => hook.result.current.alternar("a", async () => fonte("blob:a")));
    act(() => vi.advanceTimersByTime(DURACAO_DA_PREVIA_MS));
    expect(hook.result.current.estadoDe("a")).toBe("parada");
    await act(async () => hook.result.current.alternar("a", async () => fonte("blob:a")));
    act(() => audio.terminar());
    expect(hook.result.current.estadoDe("a")).toBe("parada");
  });

  it("mostra o erro e volta a ficar parada quando a prévia falha", async () => {
    const { hook, aoMudar } = montar();
    await act(async () => hook.result.current.alternar("a", async () => Promise.reject(new Error("sem áudio"))));
    expect(hook.result.current.estadoDe("a")).toBe("parada");
    expect(hook.result.current.erro).toBe("sem áudio");
    expect(aoMudar).not.toHaveBeenCalledWith(true);
  });

  it("para ao sair da tela", async () => {
    const { audio, hook, aoMudar } = montar();
    await act(async () => hook.result.current.alternar("a", async () => fonte("blob:a")));
    hook.unmount();
    expect(audio.pause).toHaveBeenCalled();
    expect(aoMudar).toHaveBeenLastCalledWith(false);
  });
});
