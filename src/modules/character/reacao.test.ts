import { DURACAO_DA_REACAO, combinarAjustes, expressoesComReacao, novaReacao, reacaoDoAtor, reacaoDoFimDaPartida } from "./reacao";

describe("reacaoDoAtor", () => {
  it("sem reação, não mexe em nada", () => {
    const { ossos, expressoes, ativa } = reacaoDoAtor(null, 0);
    expect(ativa).toBe(false);
    expect(ossos).toEqual({});
    expect(expressoes).toEqual({});
  });

  it("errar dá um tranco curto para trás com cara de dor, e passa", () => {
    const logo = reacaoDoAtor("errou", 0.08);
    expect(logo.ativa).toBe(true);
    expect(logo.ossos.head[0]).toBeLessThan(-0.1);
    expect(logo.expressoes.sad).toBeGreaterThan(0.5);
    expect(reacaoDoAtor("errou", DURACAO_DA_REACAO.errou + 0.01).ativa).toBe(false);
  });

  it("o tranco do erro começa e termina suave, sem saltar", () => {
    expect(Math.abs(reacaoDoAtor("errou", 0).ossos.head?.[0] ?? 0)).toBeLessThan(0.02);
    expect(Math.abs(reacaoDoAtor("errou", DURACAO_DA_REACAO.errou - 0.01).ossos.head?.[0] ?? 0)).toBeLessThan(0.05);
  });

  it("no nitro, abre a boca de surpresa e depois sorri balançando a cabeça", () => {
    expect(reacaoDoAtor("nitro", 0.1).expressoes.surprised).toBeGreaterThan(0.6);
    const depois = reacaoDoAtor("nitro", 0.8);
    expect(depois.expressoes.happy).toBeGreaterThan(0.6);
    const cabecas = [0.7, 0.8, 0.9, 1].map((t) => reacaoDoAtor("nitro", t).ossos.head[0]);
    expect(Math.max(...cabecas) - Math.min(...cabecas)).toBeGreaterThan(0.15);
  });

  it("no nitro, inclina o corpo para trás", () => {
    expect(reacaoDoAtor("nitro", 0.3).ossos.spine[0]).toBeLessThan(-0.1);
  });

  it("vitória e derrota ficam até o fim, sem acabar sozinhas", () => {
    expect(DURACAO_DA_REACAO.vitoria).toBe(Infinity);
    expect(reacaoDoAtor("vitoria", 60).ativa).toBe(true);
    expect(reacaoDoAtor("derrota", 60).ativa).toBe(true);
  });

  it("na vitória sorri e olha para cima; na derrota desaba e fica triste", () => {
    const vitoria = reacaoDoAtor("vitoria", 2);
    expect(vitoria.expressoes.happy).toBe(1);
    expect(vitoria.ossos.spine[0]).toBeLessThan(0);
    const derrota = reacaoDoAtor("derrota", 2);
    expect(derrota.expressoes.sad).toBe(1);
    expect(derrota.ossos.spine[0]).toBeGreaterThan(0.2);
    expect(derrota.ossos.head[0]).toBeGreaterThan(0.3);
  });
});

describe("combinarAjustes", () => {
  it("soma as rotações dos ossos que aparecem nos dois", () => {
    const resultado = combinarAjustes({ head: [0.1, 0, 0], neck: [0, 0.2, 0] }, { head: [0.2, 0.1, 0], spine: [0, 0, 0.3] });
    expect(resultado.head[0]).toBeCloseTo(0.3);
    expect(resultado.head[1]).toBeCloseTo(0.1);
    expect(resultado.neck).toEqual([0, 0.2, 0]);
    expect(resultado.spine).toEqual([0, 0, 0.3]);
  });
});

describe("novaReacao", () => {
  it("cada reação nova tem um número diferente, mesmo repetindo o tipo", () => {
    const primeira = novaReacao(null, "errou");
    const segunda = novaReacao(primeira, "errou");
    expect(primeira).toEqual({ tipo: "errou", contador: 1 });
    expect(segunda).toEqual({ tipo: "errou", contador: 2 });
  });
});

describe("expressoesComReacao", () => {
  it("a expressão da reação vence a do humor do personagem, e o resto continua", () => {
    const pesos = expressoesComReacao({ relaxed: 0.55, blink: 0.4, sad: 0.8 }, { sad: 0.2, surprised: 1 });
    expect(pesos).toEqual({ relaxed: 0.55, blink: 0.4, sad: 0.2, surprised: 1 });
  });
});

describe("reacaoDoFimDaPartida", () => {
  it("terminou bem comemora; foi vaiado desaba; ainda tocando, nada", () => {
    expect(reacaoDoFimDaPartida({ terminou: true, derrota: false })?.tipo).toBe("vitoria");
    expect(reacaoDoFimDaPartida({ terminou: true, derrota: true })?.tipo).toBe("derrota");
    expect(reacaoDoFimDaPartida({ terminou: false, derrota: false })).toBeNull();
  });

  it("devolve sempre o mesmo contador, para não reiniciar a reação a cada atualização", () => {
    expect(reacaoDoFimDaPartida({ terminou: true, derrota: false })).toEqual(reacaoDoFimDaPartida({ terminou: true, derrota: false }));
  });
});
