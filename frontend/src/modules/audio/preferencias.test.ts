import { AudioContextFalso } from "@/test/audioFalso";
import { PREFERENCIAS_DE_AUDIO_PADRAO, lerPreferenciasDeAudio } from "./armazenamento";

vi.stubGlobal("AudioContext", AudioContextFalso);

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

/** Cada recarga da página começa do zero: o módulo de áudio é importado de novo. */
const recarregar = async () => ({ ...(await import("./volume")), ...(await import("./preferencias")) });

describe("lerPreferenciasDeAudio", () => {
  it("sem nada salvo, devolve o padrão", () => {
    expect(lerPreferenciasDeAudio()).toEqual(PREFERENCIAS_DE_AUDIO_PADRAO);
  });

  it("não há mais volume à parte para a música do menu, nem vindo das configurações antigas", () => {
    localStorage.setItem("riffrush.configuracoes", JSON.stringify({ volumeDoPlayer: 0.3 }));
    expect(lerPreferenciasDeAudio()).not.toHaveProperty("volumeDoPlayer");
  });

  it("aproveita os volumes salvos nas configurações antigas do Rock", () => {
    localStorage.setItem("riffrush.configuracoes", JSON.stringify({ volumeGeral: 0.4, volumeDosEfeitos: 0.1, teclas: [] }));
    expect(lerPreferenciasDeAudio()).toEqual({ ...PREFERENCIAS_DE_AUDIO_PADRAO, volumeGeral: 0.4, volumeDosEfeitos: 0.1 });
  });

  it("valor quebrado ou fora de 0 a 1 volta ao padrão ou ao limite", () => {
    localStorage.setItem("riffrush.audio", JSON.stringify({ volumeGeral: 7, volumeDaMusica: "alto", volumeDosEfeitos: -1 }));
    expect(lerPreferenciasDeAudio()).toEqual({ ...PREFERENCIAS_DE_AUDIO_PADRAO, volumeGeral: 1, volumeDosEfeitos: 0 });
  });
});

describe("áudio global", () => {
  // O bug: só o Rock aplicava o volume salvo ao abrir; o Mania abria sempre em 100%.
  it("ao abrir a página, o volume geral já é o salvo, em qualquer modo", async () => {
    localStorage.setItem("riffrush.audio", JSON.stringify({ volumeGeral: 0.4 }));
    const { lerVolumeGeral } = await recarregar();
    expect(lerVolumeGeral()).toBe(0.4);
  });

  it("o volume geral mudado (pelo slider ou pelo Alt + roda) continua depois de recarregar", async () => {
    (await recarregar()).definirVolumeGeral(0.25);
    expect((await recarregar()).lerVolumeGeral()).toBe(0.25);
  });

  it("a mistura mudada num lugar vale em todos e continua depois de recarregar", async () => {
    const audio = await recarregar();
    const ouvinte = vi.fn();
    audio.preferenciasDeAudio.inscrever(ouvinte);
    audio.mudarPreferenciasDeAudio({ volumeDaMusica: 0.6, volumeGeral: 0.5 });
    expect(ouvinte).toHaveBeenCalled();
    expect(audio.preferenciasDeAudio.estado()).toMatchObject({ volumeDaMusica: 0.6, volumeGeral: 0.5 });
    expect(audio.lerVolumeGeral()).toBe(0.5);
    const depois = await recarregar();
    expect(depois.preferenciasDeAudio.estado()).toEqual({ ...PREFERENCIAS_DE_AUDIO_PADRAO, volumeDaMusica: 0.6, volumeGeral: 0.5 });
  });
});
