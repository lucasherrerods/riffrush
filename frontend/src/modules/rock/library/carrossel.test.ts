import { ALTURA_DA_DIFICULDADE, ALTURA_DA_MUSICA, ESPACO, RAIO_DA_CURVA, centroDoGrupoAberto, passosDaRoda, passosDoArraste, passosSemDarAVolta, posicoesNoCarrossel, recuoNaCurva } from "./carrossel";

describe("posicoesNoCarrossel", () => {
  it("põe a selecionada no zero, as de cima antes e as de baixo depois", () => {
    const posicoes = posicoesNoCarrossel(3, 1, 0);
    expect(posicoes).toEqual([-(ALTURA_DA_MUSICA + ESPACO), 0, ALTURA_DA_MUSICA + ESPACO]);
  });

  it("as dificuldades abertas embaixo da selecionada empurram só as músicas de baixo", () => {
    const fechado = posicoesNoCarrossel(3, 1, 0);
    const aberto = posicoesNoCarrossel(3, 1, 4);
    const altura = 4 * (ALTURA_DA_DIFICULDADE + ESPACO);
    expect(aberto[0]).toBe(fechado[0]);
    expect(aberto[1]).toBe(0);
    expect(aberto[2]).toBe(fechado[2] + altura);
  });
});

describe("centroDoGrupoAberto", () => {
  // Bug: centrando só a música, as últimas dificuldades ficavam fora da tela no celular.
  it("é o meio da música selecionada somada às dificuldades abertas embaixo dela", () => {
    expect(centroDoGrupoAberto(0)).toBe(ALTURA_DA_MUSICA / 2);
    expect(centroDoGrupoAberto(4)).toBe((ALTURA_DA_MUSICA + 4 * (ALTURA_DA_DIFICULDADE + ESPACO)) / 2);
  });
});

describe("recuoNaCurva", () => {
  it("o centro fica na frente e quem se afasta vai para trás, como numa roda", () => {
    expect(recuoNaCurva(0)).toBe(0);
    expect(recuoNaCurva(200)).toBeGreaterThan(0);
    expect(recuoNaCurva(400)).toBeGreaterThan(recuoNaCurva(200));
  });

  it("é igual para cima e para baixo", () => {
    expect(recuoNaCurva(-300)).toBe(recuoNaCurva(300));
  });

  it("não passa do raio da roda, mesmo bem longe do centro", () => {
    expect(recuoNaCurva(RAIO_DA_CURVA * 3)).toBe(RAIO_DA_CURVA);
  });
});

describe("passosDaRoda", () => {
  it("cada volta inteira da roda do mouse anda uma música e guarda o resto", () => {
    expect(passosDaRoda(130)).toEqual({ passos: 1, resto: 30 });
    expect(passosDaRoda(-250)).toEqual({ passos: -2, resto: -50 });
  });

  it("um toque leve no touchpad não anda nada ainda", () => {
    expect(passosDaRoda(40)).toEqual({ passos: 0, resto: 40 });
  });
});

describe("passosDoArraste", () => {
  it("arrastar o dedo para cima a altura de uma música anda uma para frente", () => {
    expect(passosDoArraste(ALTURA_DA_MUSICA)).toEqual({ passos: 1, resto: 0 });
  });

  it("arrastar para baixo volta, e o que não completa uma música fica guardado", () => {
    expect(passosDoArraste(-ALTURA_DA_MUSICA * 2 - 10)).toEqual({ passos: -2, resto: -10 });
  });
});

describe("passosSemDarAVolta", () => {
  it("no topo, arrastar para trás não pula para a última música", () => {
    expect(passosSemDarAVolta(0, -2, 5)).toBe(0);
  });

  it("na última, arrastar para frente não volta para o topo", () => {
    expect(passosSemDarAVolta(4, 1, 5)).toBe(0);
  });

  it("anda só até a borda", () => {
    expect(passosSemDarAVolta(3, 3, 5)).toBe(1);
    expect(passosSemDarAVolta(1, -3, 5)).toBe(-1);
  });
});
