import { categoriaDoMaterial, escalasDoCorpo, fatorDeTinta, pesosDasExpressoes } from "./aparencia";

describe("categoriaDoMaterial", () => {
  it("reconhece os materiais no padrão de nomes do VRoid", () => {
    expect(categoriaDoMaterial("Body_00_SKIN")).toBe("pele");
    expect(categoriaDoMaterial("Face_00_SKIN")).toBe("pele");
    expect(categoriaDoMaterial("Hair_00_HAIR")).toBe("cabelo");
    expect(categoriaDoMaterial("HairBack_00_HAIR")).toBe("cabelo");
    expect(categoriaDoMaterial("EyeIris_00_EYE")).toBe("olhos");
    expect(categoriaDoMaterial("Tops_01_CLOTH")).toBe("roupa");
    expect(categoriaDoMaterial("Onepiece_00_CLOTH")).toBe("roupa");
    expect(categoriaDoMaterial("Bottoms_01_CLOTH")).toBe("calca");
    expect(categoriaDoMaterial("Shoes_01_CLOTH")).toBe("calcados");
  });

  it("ignora o que não deve mudar de cor (branco do olho, boca, contornos)", () => {
    expect(categoriaDoMaterial("EyeWhite_00_EYE")).toBeNull();
    expect(categoriaDoMaterial("EyeHighlight_00_EYE")).toBeNull();
    expect(categoriaDoMaterial("FaceMouth_00_FACE")).toBeNull();
    expect(categoriaDoMaterial("FaceEyeline_00_FACE")).toBeNull();
  });

  it("aceita os sufixos com número que o three.js cria para materiais repetidos", () => {
    expect(categoriaDoMaterial("Hair_00_HAIR (Instance)")).toBe("cabelo");
    expect(categoriaDoMaterial("Tops_01_CLOTH_1")).toBe("roupa");
  });
});

describe("fatorDeTinta", () => {
  it("leva a cor média da textura até a cor escolhida, mantendo o desenho", () => {
    const [r, g, b] = fatorDeTinta([0.5, 0.25, 0.1], [0.25, 0.25, 0.3]);
    expect(r * 0.5).toBeCloseTo(0.25);
    expect(g * 0.25).toBeCloseTo(0.25);
    expect(b * 0.1).toBeCloseTo(0.3);
  });

  it("limita o fator para texturas quase pretas não estourarem", () => {
    for (const canal of fatorDeTinta([0.001, 0.001, 0.001], [1, 1, 1])) expect(canal).toBeLessThanOrEqual(4);
  });
});

describe("escalasDoCorpo", () => {
  const meio = { altura: 0.5, porte: 0.5, ombros: 0.5 };

  it("no meio dos sliders mantém o modelo original", () => {
    const escalas = escalasDoCorpo(meio);
    expect(escalas.altura).toBeCloseTo(1);
    for (const [x, y, z] of Object.values(escalas.ossos)) {
      expect(x).toBeCloseTo(1);
      expect(y).toBeCloseTo(1);
      expect(z).toBeCloseTo(1);
    }
  });

  it("a altura escala o personagem inteiro", () => {
    expect(escalasDoCorpo({ ...meio, altura: 1 }).altura).toBeGreaterThan(1);
    expect(escalasDoCorpo({ ...meio, altura: 0 }).altura).toBeLessThan(1);
  });

  it("o porte alarga o tronco e devolve a cabeça ao tamanho normal", () => {
    const { ossos } = escalasDoCorpo({ ...meio, porte: 1 });
    expect(ossos.spine[0]).toBeGreaterThan(1);
    expect(ossos.spine[0] * ossos.neck[0]).toBeCloseTo(1);
  });

  it("os ombros alargam o peito sem engrossar os braços", () => {
    const { ossos } = escalasDoCorpo({ ...meio, ombros: 1 });
    expect(ossos.upperChest[0]).toBeGreaterThan(1);
    expect(ossos.upperChest[0] * ossos.leftShoulder[0]).toBeCloseTo(1);
    expect(ossos.upperChest[0] * ossos.rightShoulder[0]).toBeCloseTo(1);
  });
});

describe("pesosDasExpressoes", () => {
  const base = { expressao: "neutra" as const, triste: false, tempo: 0.5, desdeOPulso: Infinity };

  it("aplica a expressão escolhida", () => {
    expect(pesosDasExpressoes({ ...base, expressao: "alegre" }).happy).toBeGreaterThan(0);
    expect(pesosDasExpressoes({ ...base, expressao: "determinada" }).angry).toBeGreaterThan(0);
  });

  it("triste vence a expressão escolhida", () => {
    const pesos = pesosDasExpressoes({ ...base, expressao: "alegre", triste: true });
    expect(pesos.sad).toBeGreaterThan(0.5);
    expect(pesos.happy ?? 0).toBe(0);
  });

  it("sorri por um instante ao acertar uma nota", () => {
    expect(pesosDasExpressoes({ ...base, desdeOPulso: 0.05 }).happy).toBeGreaterThan(pesosDasExpressoes({ ...base, desdeOPulso: 2 }).happy ?? 0);
  });

  it("pisca de tempos em tempos", () => {
    const piscadas = Array.from({ length: 400 }, (_, i) => pesosDasExpressoes({ ...base, tempo: i * 0.025 }).blink ?? 0);
    expect(Math.max(...piscadas)).toBeGreaterThan(0.9);
    expect(piscadas.filter((p) => p > 0.5).length).toBeLessThan(piscadas.length / 4);
  });
});
