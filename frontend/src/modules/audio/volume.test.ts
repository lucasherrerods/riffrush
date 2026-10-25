import { AudioContextFalso } from "@/test/audioFalso";
import { obterContextoDeAudio } from "./contexto";
import { definirVolumeGeral, instalarAtalhosDeVolume, lerVolumeGeral, proximoVolume, saidaDeAudio, volumeGeral } from "./volume";

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

  it("Ctrl + roda também, e o navegador não dá zoom", () => {
    const evento = rodar(-100, { ctrlKey: true });
    expect(lerVolumeGeral()).toBe(0.55);
    expect(evento.defaultPrevented).toBe(true);
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

  it("Ctrl + ↑/↓ mexe no volume e não chega nas telas (que andariam no menu)", () => {
    const daTela = vi.fn();
    window.addEventListener("keydown", daTela);
    const evento = tecla("keydown", { code: "ArrowUp", key: "ArrowUp", ctrlKey: true });
    expect(lerVolumeGeral()).toBe(0.55);
    expect(evento.defaultPrevented).toBe(true);
    expect(daTela).not.toHaveBeenCalled();
    tecla("keydown", { code: "ArrowDown", key: "ArrowDown", ctrlKey: true });
    expect(lerVolumeGeral()).toBe(0.5);
    tecla("keydown", { code: "ArrowDown", key: "ArrowDown" });
    expect(daTela).toHaveBeenCalledTimes(1);
    window.removeEventListener("keydown", daTela);
  });

  it("Ctrl + ↑/↓ dentro de um campo de texto fica com o campo", () => {
    const campo = document.createElement("input");
    document.body.append(campo);
    campo.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp", key: "ArrowUp", ctrlKey: true, bubbles: true, cancelable: true }));
    expect(lerVolumeGeral()).toBe(0.5);
    campo.remove();
  });

  it("soltar o Alt depois de mexer no volume não abre a barra de menu do navegador", () => {
    tecla("keydown", { key: "Alt", code: "AltLeft", altKey: true });
    rodar(-100, { altKey: true });
    expect(tecla("keyup", { key: "Alt", code: "AltLeft" }).defaultPrevented).toBe(true);
    // Um Alt sozinho, sem mexer no volume, segue normal.
    tecla("keydown", { key: "Alt", code: "AltLeft", altKey: true });
    expect(tecla("keyup", { key: "Alt", code: "AltLeft" }).defaultPrevented).toBe(false);
  });

  it("a mudança pelo atalho marca que é para mostrar o indicador", () => {
    rodar(-100, { altKey: true });
    expect(volumeGeral.estado().peloAtalho).toBeGreaterThan(0);
  });
});
