import { AudioContextFalso, comAudioFalso } from "@/test/audioFalso";

const importar = () => comAudioFalso(() => import("./desbloqueio"));

describe("desbloquearNoPrimeiroToque", () => {
  // No iPhone o Safari só libera o som dentro de um toque. Sem isso, quem entra pelo QR code
  // fica sem som, porque a largada da partida chega pela rede e não por um toque.
  it("cria e acorda o áudio no primeiro toque na tela", async () => {
    const { desbloquearNoPrimeiroToque } = await importar();
    desbloquearNoPrimeiroToque();
    expect(AudioContextFalso.instancias).toHaveLength(0);
    window.dispatchEvent(new Event("pointerdown"));
    expect(AudioContextFalso.instancias).toHaveLength(1);
  });

  it("toca um som mudo dentro do toque, que é o que o Safari exige", async () => {
    const { desbloquearNoPrimeiroToque } = await importar();
    desbloquearNoPrimeiroToque();
    window.dispatchEvent(new Event("touchend"));
    expect(AudioContextFalso.instancias[0].fontes[0].inicio).toBe(0);
  });

  it("também funciona com o teclado", async () => {
    const { desbloquearNoPrimeiroToque } = await importar();
    desbloquearNoPrimeiroToque();
    window.dispatchEvent(new KeyboardEvent("keydown"));
    expect(AudioContextFalso.instancias).toHaveLength(1);
  });

  it("só faz isso uma vez", async () => {
    const { desbloquearNoPrimeiroToque } = await importar();
    desbloquearNoPrimeiroToque();
    window.dispatchEvent(new Event("pointerdown"));
    window.dispatchEvent(new Event("pointerdown"));
    expect(AudioContextFalso.instancias[0].fontes).toHaveLength(1);
  });
});
