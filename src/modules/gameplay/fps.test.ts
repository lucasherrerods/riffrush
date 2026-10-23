import { criarContadorDeFps } from "./fps";

describe("criarContadorDeFps", () => {
  it("conta os quadros de cada meio segundo e devolve por segundo", () => {
    const contador = criarContadorDeFps();
    let fps: number | null = null;
    // 60 quadros por segundo durante 0,6 s.
    for (let i = 0; i <= 36; i++) fps = contador.quadro(i * (1000 / 60)) ?? fps;
    expect(fps).toBeCloseTo(60, 0);
  });

  it("só devolve um valor novo quando fecha a janela, para o HUD não re-renderizar a cada quadro", () => {
    const contador = criarContadorDeFps();
    expect(contador.quadro(0)).toBeNull();
    expect(contador.quadro(16)).toBeNull();
    expect(contador.quadro(600)).not.toBeNull();
  });

  it("acompanha uma queda de desempenho", () => {
    const contador = criarContadorDeFps();
    let fps: number | null = null;
    for (let i = 0; i <= 30; i++) fps = contador.quadro(i * (1000 / 30)) ?? fps;
    expect(fps).toBeCloseTo(30, 0);
  });
});
