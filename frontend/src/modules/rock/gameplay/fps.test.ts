import { criarContadorDeFps } from "./fps";

describe("criarContadorDeFps", () => {
  it("conta os quadros de cada meio segundo e devolve por segundo", () => {
    const contador = criarContadorDeFps();
    let fps: number | null = null;
    // 60 quadros por segundo durante 0,6 s.
    for (let i = 0; i <= 36; i++) fps = contador.quadro(i * (1000 / 60))?.fps ?? fps;
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
    for (let i = 0; i <= 30; i++) fps = contador.quadro(i * (1000 / 30))?.fps ?? fps;
    expect(fps).toBeCloseTo(30, 0);
  });

  it("mostra o quadro mais lento da janela, que revela engasgos mesmo travado em 60", () => {
    const contador = criarContadorDeFps();
    const tempos = [0, 16, 32, 48, 98, 114, 130, 146, 162, 178, 194, 210, 226, 242, 258, 274, 290, 306, 322, 338, 354, 370, 386, 402, 418, 434, 450, 466, 482, 498, 514];
    let piorQuadroMs: number | null = null;
    for (const t of tempos) piorQuadroMs = contador.quadro(t)?.piorQuadroMs ?? piorQuadroMs;
    expect(piorQuadroMs).toBe(50);
  });
});
