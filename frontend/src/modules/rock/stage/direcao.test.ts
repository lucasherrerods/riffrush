import { ambienteDoShow, luzesDoPalco, opacidadeDaPista, planoDaCamera } from "./direcao";

const distancia = (p: { posicao: number[]; alvo: number[] }) => Math.hypot(...p.posicao.map((v, i) => v - p.alvo[i]));

describe("planoDaCamera", () => {
  it("abre a partida num close do personagem e recua até o plano aberto", () => {
    const close = planoDaCamera(-3, 3, 1.6);
    const meio = planoDaCamera(-1.5, 3, 1.6);
    const aberto = planoDaCamera(0, 3, 1.6);
    expect(distancia(close)).toBeLessThan(2);
    expect(distancia(meio)).toBeGreaterThan(distancia(close));
    expect(distancia(aberto)).toBeGreaterThan(distancia(meio));
  });

  it("no close mira no rosto", () => {
    expect(planoDaCamera(-3, 3, 1.6).alvo[1]).toBeGreaterThan(1.3);
  });

  it("durante a música o personagem fica à direita da pista, não atrás dela", () => {
    const plano = planoDaCamera(30, 3, 1.6);
    // O personagem está em x = 0; a câmera fica à esquerda dele.
    expect(plano.posicao[0]).toBeLessThan(-0.5);
    // E mira à esquerda dele, no espaço da pista.
    expect(plano.alvo[0]).toBeLessThan(0);
  });

  it("depois da abertura balança devagar, sem cortes", () => {
    const a = planoDaCamera(10, 3, 1.6);
    const b = planoDaCamera(10.03, 3, 1.6);
    expect(Math.abs(a.posicao[0] - b.posicao[0])).toBeLessThan(0.01);
    expect(a.posicao).not.toEqual(planoDaCamera(14, 3, 1.6).posicao);
  });
});

describe("opacidadeDaPista", () => {
  it("o palco domina a abertura e a pista aparece até a música começar", () => {
    expect(opacidadeDaPista(-3, 3)).toBeLessThan(0.2);
    expect(opacidadeDaPista(-1, 3)).toBeGreaterThan(opacidadeDaPista(-2, 3));
    expect(opacidadeDaPista(0, 3)).toBe(1);
    expect(opacidadeDaPista(20, 3)).toBe(1);
  });
});

describe("luzesDoPalco", () => {
  const base = { tempo: 10, bpm: 120, desdeTrovao: Infinity, estrelaAtiva: false };

  it("pulsa no ritmo: mais forte na batida do que entre batidas", () => {
    expect(luzesDoPalco({ ...base, tempo: 10 }).intensidade).toBeGreaterThan(luzesDoPalco({ ...base, tempo: 10.25 }).intensidade);
  });

  it("clareia com o trovão do combo e apaga o clarão em meio segundo", () => {
    expect(luzesDoPalco({ ...base, desdeTrovao: 0.02 }).clarao).toBeGreaterThan(0.8);
    expect(luzesDoPalco({ ...base, desdeTrovao: 0.6 }).clarao).toBe(0);
  });

  it("com star power as luzes ficam na cor da estrela", () => {
    expect(luzesDoPalco({ ...base, estrelaAtiva: true }).cor).toBe("estrela");
    expect(luzesDoPalco(base).cor).toBe("primaria");
  });

  it("durante a música as luzes ficam mais baixas que na abertura, para a pista se destacar", () => {
    expect(luzesDoPalco({ ...base, tempo: -2 }).foco).toBeGreaterThan(luzesDoPalco(base).foco);
  });
});

describe("ambienteDoShow", () => {
  const base = { tempo: 10, sequencia: 0, multiplicador: 1, estrelaAtiva: false, apagando: false };

  it("a luz do show sobe quando a música começa", () => {
    expect(ambienteDoShow({ ...base, tempo: 5 }).luz).toBeGreaterThan(ambienteDoShow({ ...base, tempo: -2 }).luz);
  });

  it("sem sequência longa os refletores não pulsam", () => {
    expect(ambienteDoShow({ ...base, sequencia: 10 }).pulso).toBe(0);
  });

  it("a sequência longa faz os refletores pulsarem, mais forte quanto maior", () => {
    const media = ambienteDoShow({ ...base, sequencia: 30 }).pulso;
    const longa = ambienteDoShow({ ...base, sequencia: 150 }).pulso;
    expect(media).toBeGreaterThan(0);
    expect(longa).toBeGreaterThan(media);
    expect(longa).toBeLessThanOrEqual(1);
  });

  it("multiplicador no máximo acende mais e solta flashes nas laterais", () => {
    const alto = ambienteDoShow({ ...base, multiplicador: 4 });
    expect(alto.flashes).toBe(true);
    expect(alto.luz).toBeGreaterThan(ambienteDoShow(base).luz);
    expect(ambienteDoShow({ ...base, multiplicador: 2 }).flashes).toBe(false);
  });

  it("no star power a paleta vira a da estrela", () => {
    expect(ambienteDoShow({ ...base, estrelaAtiva: true }).paleta).toBe("estrela");
    expect(ambienteDoShow(base).paleta).toBe("show");
  });

  it("na falha ou no fim da música o palco apaga e para os efeitos", () => {
    const fim = ambienteDoShow({ ...base, multiplicador: 4, sequencia: 200, apagando: true });
    expect(fim.luz).toBeLessThan(ambienteDoShow({ ...base, tempo: -2 }).luz);
    expect(fim.pulso).toBe(0);
    expect(fim.flashes).toBe(false);
  });
});
