import { ALTURA_DA_DIFICULDADE, ALTURA_DA_MUSICA, ESPACO, RAIO_DA_CURVA, centroDoGrupoAberto, centroDoGrupoNaTela, limitar, limitesDoDeslocamento, passoDaInercia, VELOCIDADE_PARADA, indiceDandoAVolta, passosSemDarAVolta, posicoesNoCarrossel, recuoNaCurva } from "./geometriaDoCarrossel";

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

describe("centroDoGrupoNaTela", () => {
  const passoDif = ALTURA_DA_DIFICULDADE + ESPACO;
  const topoDa = (i: number) => ALTURA_DA_MUSICA + ESPACO + i * passoDif;
  const visivel = 400;

  it("se o grupo cabe na tela, fica no meio dele", () => {
    expect(centroDoGrupoNaTela(4, 3, 2000)).toBe(centroDoGrupoAberto(4));
  });

  it("sem saber a altura da tela, fica no meio", () => {
    expect(centroDoGrupoNaTela(12, 11, 0)).toBe(centroDoGrupoAberto(12));
  });

  // Bug: com 12 dificuldades (4K a 9K) o grupo centralizado cortava a música no topo e as últimas embaixo.
  it("se não cabe, mostra do topo para baixo, com a música aparecendo", () => {
    expect(centroDoGrupoNaTela(12, 0, visivel)).toBe(visivel / 2);
  });

  it("descendo pelo teclado, a dificuldade escolhida continua na tela", () => {
    const centro = centroDoGrupoNaTela(12, 11, visivel);
    expect(topoDa(11) - centro).toBeGreaterThanOrEqual(-visivel / 2);
    expect(topoDa(11) + ALTURA_DA_DIFICULDADE - centro).toBeLessThanOrEqual(visivel / 2);
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

describe("limitesDoDeslocamento", () => {
  it("vai da primeira até a última música no centro da tela", () => {
    const posicoes = posicoesNoCarrossel(5, 2, 0);
    const centro = centroDoGrupoAberto(0);
    expect(limitesDoDeslocamento(posicoes, centro)).toEqual({ min: posicoes[0], max: posicoes[4] });
  });

  it("sem músicas não anda", () => {
    expect(limitesDoDeslocamento([], 40)).toEqual({ min: 0, max: 0 });
  });

  // Bug: com uma música só e 12 dificuldades, não dava para rolar até as últimas.
  it("deixa descer até a última dificuldade aberta, mesmo sem músicas embaixo", () => {
    const centro = centroDoGrupoAberto(12);
    const ultima = ALTURA_DA_MUSICA + ESPACO + 11 * (ALTURA_DA_DIFICULDADE + ESPACO) + ALTURA_DA_DIFICULDADE / 2;
    expect(limitesDoDeslocamento([0], centro, 12).max).toBe(ultima - centro);
  });

  it("limitar segura o arraste nas bordas", () => {
    expect(limitar(-500, { min: -100, max: 100 })).toBe(-100);
    expect(limitar(500, { min: -100, max: 100 })).toBe(100);
    expect(limitar(30, { min: -100, max: 100 })).toBe(30);
  });
});

describe("passoDaInercia", () => {
  it("continua andando no sentido do arraste e vai freando", () => {
    const um = passoDaInercia(1, 16);
    expect(um.andou).toBeGreaterThan(0);
    expect(um.velocidade).toBeLessThan(1);
    const dois = passoDaInercia(um.velocidade, 16);
    expect(dois.andou).toBeLessThan(um.andou);
  });

  it("para de vez quando fica lenta demais", () => {
    expect(passoDaInercia(VELOCIDADE_PARADA, 16).velocidade).toBe(0);
  });

  it("a distância total é finita, não roda para sempre", () => {
    let v = 2;
    let total = 0;
    for (let i = 0; i < 1000 && v; i++) {
      const passo = passoDaInercia(v, 16);
      total += passo.andou;
      v = passo.velocidade;
    }
    expect(v).toBe(0);
    expect(total).toBeLessThan(2 * 325 + 1);
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

describe("indiceDandoAVolta", () => {
  it("passa da última para a primeira e da primeira para a última", () => {
    expect(indiceDandoAVolta(4, 1, 5)).toBe(0);
    expect(indiceDandoAVolta(0, -1, 5)).toBe(4);
    expect(indiceDandoAVolta(2, 10, 5)).toBe(2);
  });

  it("sem itens, fica no zero", () => {
    expect(indiceDandoAVolta(0, 1, 0)).toBe(0);
  });
});
