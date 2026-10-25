import { AudioContextFalso } from "@/test/audioFalso";
import { obterContextoDeAudio } from "./contexto";
import { definirVolumeGeral, focoSaiuPeloAlt, instalarAtalhosDeVolume, lerVolumeGeral, proximoVolume, saidaDeAudio, volumeGeral } from "./volume";

vi.stubGlobal("AudioContext", AudioContextFalso);

describe("proximoVolume", () => {
  it("sobe e desce de 5 em 5%, entre 0 e 100%", () => {
    expect(proximoVolume(0.5, 1)).toBe(0.55);
    expect(proximoVolume(0.5, -1)).toBe(0.45);
    expect(proximoVolume(0.98, 1)).toBe(1);
    expect(proximoVolume(0.02, -1)).toBe(0);
  });

  it("volume fora da grade cai no passo mais próximo, sem acumular erro de ponto flutuante", () => {
    expect(proximoVolume(0.33, 1)).toBe(0.4);
    let v = 0;
    for (let i = 0; i < 20; i++) v = proximoVolume(v, 1);
    expect(v).toBe(1);
  });
});

describe("saída de áudio", () => {
  it("todos os sons passam por um ganho mestre ligado na saída, que segue o volume geral", () => {
    definirVolumeGeral(0.4);
    const saida = saidaDeAudio() as unknown as { gain: { value: number }; conectadoEm: unknown[] };
    expect(saida).toBe(saidaDeAudio());
    expect(saida.conectadoEm).toContain(obterContextoDeAudio().destination);
    definirVolumeGeral(0.7);
    expect(lerVolumeGeral()).toBe(0.7);
  });

  it("avisa quem acompanha o volume", () => {
    const ouvinte = vi.fn();
    const sair = volumeGeral.inscrever(ouvinte);
    definirVolumeGeral(0.2);
    expect(ouvinte).toHaveBeenCalled();
    expect(volumeGeral.estado().volume).toBe(0.2);
    sair();
  });
});

describe("atalhos de volume", () => {
  let desinstalar: () => void;
  beforeEach(() => {
    definirVolumeGeral(0.5);
    desinstalar = instalarAtalhosDeVolume(window);
  });
  afterEach(() => desinstalar());

  const rodar = (deltaY: number, teclas: WheelEventInit = {}) => {
    const evento = new WheelEvent("wheel", { deltaY, cancelable: true, bubbles: true, ...teclas });
    document.body.dispatchEvent(evento);
    return evento;
  };
  const tecla = (tipo: "keydown" | "keyup", init: KeyboardEventInit) => {
    const evento = new KeyboardEvent(tipo, { cancelable: true, bubbles: true, ...init });
    document.body.dispatchEvent(evento);
    return evento;
  };

  it("Alt + roda sobe e desce o volume, sem a roda fazer o que faria na página", () => {
    const subir = rodar(-100, { altKey: true });
    expect(lerVolumeGeral()).toBe(0.55);
    expect(subir.defaultPrevented).toBe(true);
    rodar(100, { altKey: true });
    rodar(100, { altKey: true });
    expect(lerVolumeGeral()).toBe(0.45);
  });

  it("Ctrl + roda fica com o navegador: só o Alt mexe no volume", () => {
    const evento = rodar(-100, { ctrlKey: true });
    expect(lerVolumeGeral()).toBe(0.5);
    expect(evento.defaultPrevented).toBe(false);
  });

  it("a roda sozinha continua rolando a página", () => {
    const evento = rodar(-100);
    expect(lerVolumeGeral()).toBe(0.5);
    expect(evento.defaultPrevented).toBe(false);
  });

  it("com o Shift junto, o navegador manda a roda no eixo X: vale também", () => {
    const evento = new WheelEvent("wheel", { deltaX: -100, altKey: true, shiftKey: true, cancelable: true, bubbles: true });
    document.body.dispatchEvent(evento);
    expect(lerVolumeGeral()).toBe(0.55);
  });

  it("Ctrl + ↑/↓ não mexe no volume e segue para as telas", () => {
    const daTela = vi.fn();
    window.addEventListener("keydown", daTela);
    const evento = tecla("keydown", { code: "ArrowUp", key: "ArrowUp", ctrlKey: true });
    expect(lerVolumeGeral()).toBe(0.5);
    expect(evento.defaultPrevented).toBe(false);
    expect(daTela).toHaveBeenCalled();
    window.removeEventListener("keydown", daTela);
  });

  it("o Alt nunca faz o que faria no navegador: nem ao apertar, nem ao soltar", () => {
    expect(tecla("keydown", { key: "Alt", code: "AltLeft", altKey: true }).defaultPrevented).toBe(true);
    rodar(-100, { altKey: true });
    expect(tecla("keyup", { key: "Alt", code: "AltLeft" }).defaultPrevented).toBe(true);
    // Mesmo sem mexer no volume.
    tecla("keydown", { key: "Alt", code: "AltLeft", altKey: true });
    expect(tecla("keyup", { key: "Alt", code: "AltLeft" }).defaultPrevented).toBe(true);
  });

  it("o foco que sai logo depois de soltar o Alt é do Alt (modo menu), não de trocar de janela", () => {
    tecla("keydown", { key: "Alt", code: "AltLeft", altKey: true });
    rodar(-100, { altKey: true });
    tecla("keyup", { key: "Alt", code: "AltLeft" });
    const agora = performance.now();
    expect(focoSaiuPeloAlt(agora)).toBe(true);
    expect(focoSaiuPeloAlt(agora + 600)).toBe(false);
  });

  it("no Alt+Tab o foco sai com o Alt ainda segurado: aí não é o Alt", () => {
    tecla("keydown", { key: "Alt", code: "AltLeft", altKey: true });
    expect(focoSaiuPeloAlt()).toBe(false);
  });

  it("outra tecla depois do Alt, ou a janela voltar, zera o Alt", () => {
    tecla("keydown", { key: "Alt", code: "AltLeft", altKey: true });
    tecla("keyup", { key: "Alt", code: "AltLeft" });
    tecla("keydown", { key: "a", code: "KeyA" });
    expect(focoSaiuPeloAlt()).toBe(false);
    tecla("keyup", { key: "Alt", code: "AltLeft" });
    window.dispatchEvent(new Event("focus"));
    expect(focoSaiuPeloAlt()).toBe(false);
  });

  it("a mudança pelo atalho marca que é para mostrar o indicador", () => {
    rodar(-100, { altKey: true });
    expect(volumeGeral.estado().peloAtalho).toBeGreaterThan(0);
  });
});
