import { anotar, faixaAtual, iniciarMaratona, placarDaMaratona, proximaTocavel, pularFaixa, rotuloDeSeguir } from "./maratona";

const faixas = ["a", "b", "c"].map((musica) => ({ musica, versao: "expert", titulo: musica.toUpperCase() }));

describe("maratona", () => {
  it("começa na primeira faixa", () => {
    const m = iniciarMaratona("Treino", faixas);
    expect(faixaAtual(m)?.musica).toBe("a");
    expect(m.terminou).toBe(false);
  });

  it("anotar o resultado passa para a próxima e termina na última", () => {
    let m = iniciarMaratona("Treino", faixas);
    m = anotar(m, { pontos: 100, precisao: 0.9, derrota: false });
    expect(faixaAtual(m)?.musica).toBe("b");
    m = anotar(m, { pontos: 50, precisao: 0.5, derrota: true });
    m = anotar(m, { pontos: 150, precisao: 1, derrota: false });
    expect(m.terminou).toBe(true);
    expect(faixaAtual(m)).toBeNull();
  });

  it("pular deixa a faixa sem resultado", () => {
    let m = iniciarMaratona("Treino", faixas);
    m = pularFaixa(m);
    expect(m.resultados[0]).toBeNull();
    expect(faixaAtual(m)?.musica).toBe("b");
  });

  it("depois de terminar, anotar e pular não mudam nada", () => {
    let m = iniciarMaratona("X", faixas.slice(0, 1));
    m = anotar(m, { pontos: 1, precisao: 1, derrota: false });
    expect(anotar(m, { pontos: 9, precisao: 0, derrota: true })).toBe(m);
    expect(pularFaixa(m)).toBe(m);
  });

  it("o placar soma os pontos e faz a média da precisão só das tocadas", () => {
    let m = iniciarMaratona("Treino", faixas);
    m = anotar(m, { pontos: 100, precisao: 0.9, derrota: false });
    m = pularFaixa(m);
    m = anotar(m, { pontos: 300, precisao: 0.5, derrota: true });
    const placar = placarDaMaratona(m);
    expect({ ...placar, precisao: Number(placar.precisao.toFixed(6)) }).toEqual({ pontos: 400, precisao: 0.7, tocadas: 2, concluidas: 1, total: 3 });
  });

  it("sem nenhuma tocada, a precisão é zero", () => {
    expect(placarDaMaratona(pularFaixa(iniciarMaratona("X", faixas.slice(0, 1)))).precisao).toBe(0);
  });

  it("pula as faixas que o modo não consegue abrir até achar uma", () => {
    const { maratona, alvo } = proximaTocavel(iniciarMaratona("X", faixas), (f) => (f.musica === "c" ? "tocar c" : null));
    expect(alvo).toBe("tocar c");
    expect(maratona.resultados).toEqual([null, null]);
    expect(faixaAtual(maratona)?.musica).toBe("c");
  });

  it("sem nenhuma que abra, termina a maratona", () => {
    const { maratona, alvo } = proximaTocavel(iniciarMaratona("X", faixas), () => null);
    expect(alvo).toBeNull();
    expect(maratona.terminou).toBe(true);
  });

  it("o botão do resultado diz qual é a próxima, ou leva ao placar", () => {
    let m = anotar(iniciarMaratona("X", faixas.slice(0, 2)), { pontos: 1, precisao: 1, derrota: false });
    expect(rotuloDeSeguir(m)).toBe("Próxima música (2/2)");
    m = anotar(m, { pontos: 1, precisao: 1, derrota: false });
    expect(rotuloDeSeguir(m)).toBe("Ver a maratona");
  });

  it("playlist vazia já nasce terminada", () => {
    expect(iniciarMaratona("X", []).terminou).toBe(true);
  });
});
