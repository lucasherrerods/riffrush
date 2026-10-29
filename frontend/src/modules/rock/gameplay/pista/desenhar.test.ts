import { criarCanvasFalso } from "@/test/canvasFalso";
import { PISTA_ABERTA, type Nota } from "@/modules/rock/songs";
import { criarPartida } from "../partida";
import { CORES_DAS_PISTAS, COR_DA_ABERTA, COR_DA_ESTRELA } from "../cores";
import { desenharPista, type Cena, type Sprites } from "./desenhar";

const sprites: Sprites = {
  nota: (cor, estrela, _brilho, tipoDaNota) => ({ tipo: "nota", cor, estrela, ...(tipoDaNota && { tipoDaNota }) }) as unknown as CanvasImageSource,
  aberta: (cor, estrela, _brilho, tipoDaNota) => ({ tipo: "aberta", cor, estrela, ...(tipoDaNota && { tipoDaNota }) }) as unknown as CanvasImageSource,
  brilho: (cor) => ({ tipo: "brilho", cor }) as unknown as CanvasImageSource,
  textura: () => ({ tipo: "textura" }) as unknown as CanvasImageSource,
};

const nota = (tempo: number, pista = 0, extra: Partial<Nota> = {}): Nota => ({ tempo, pista, frase: -1, duracao: 0, ...extra });

function cena(notas: Nota[], extra: Partial<Cena> = {}): Cena {
  const partida = criarPartida(notas);
  return {
    notas: partida.notas,
    primeira: 0,
    batidas: [],
    apertados: [false, false, false, false, false, false],
    explosoes: [],
    falhas: [],
    estrelaAtiva: false,
    multiplicador: 1,
    frasesFalhas: new Set(),
    trovoes: [],
    estrelaDesde: null,
    ...extra,
  };
}

function desenhar(c: Cena, tempo = 0, efeitos = true) {
  const canvas = criarCanvasFalso();
  desenharPista(canvas.contexto, 1200, 800, tempo, 2, c, efeitos, sprites);
  return canvas;
}

describe("desenharPista", () => {
  // Bug: a luz, o cromo dos botões e o fade eram gradientes novos a cada quadro, 7 por quadro.
  it("no mesmo tamanho, o quadro seguinte reaproveita todos os gradientes", () => {
    const canvas = criarCanvasFalso();
    desenharPista(canvas.contexto, 1000, 700, 0, 2, cena([]), true, sprites);
    const antes = canvas.chamadas.length;
    desenharPista(canvas.contexto, 1000, 700, 0.1, 2, cena([]), true, sprites);
    const novos = canvas.chamadas.slice(antes).filter((c) => c.metodo.startsWith("create") && c.metodo.endsWith("Gradient"));
    expect(novos).toEqual([]);
  });

  it("desenha as notas que estão chegando, com a cor do traste", () => {
    const desenhos = desenhar(cena([nota(0.5, 1), nota(1, 3)])).desenhos();
    expect(desenhos).toEqual([
      { tipo: "nota", cor: CORES_DAS_PISTAS[3], estrela: false },
      { tipo: "nota", cor: CORES_DAS_PISTAS[1], estrela: false },
    ]);
  });

  it("HOPO e tap usam o sprite do próprio tipo, como no Clone Hero", () => {
    const desenhos = desenhar(cena([nota(0.5, 1, { tipo: "hopo" }), nota(1, 3, { tipo: "tap" })])).desenhos();
    expect(desenhos).toEqual([
      { tipo: "nota", cor: CORES_DAS_PISTAS[3], estrela: false, tipoDaNota: "tap" },
      { tipo: "nota", cor: CORES_DAS_PISTAS[1], estrela: false, tipoDaNota: "hopo" },
    ]);
  });

  it("a nota aberta é uma barra roxa que atravessa os cinco trastes", () => {
    const canvas = desenhar(cena([nota(0.5, PISTA_ABERTA, { tipo: "hopo" })]));
    expect(canvas.desenhos()).toEqual([{ tipo: "aberta", cor: COR_DA_ABERTA, estrela: false, tipoDaNota: "hopo" }]);
    const [, , , largura] = canvas.chamadas.find((c) => c.metodo === "drawImage")!.args as number[];
    const traste = canvas.chamadas.length && desenhar(cena([nota(0.5, 2)])).chamadas.find((c) => c.metodo === "drawImage")!.args[3] as number;
    expect(largura).toBeGreaterThan(traste * 3);
  });

  it("apertar a tecla da aberta acende a linha de batida inteira", () => {
    const apertada = cena([], { apertados: [false, false, false, false, false, true] });
    expect(desenhar(apertada).desenhos()).toEqual([{ tipo: "brilho", cor: COR_DA_ABERTA }]);
  });

  it("não desenha notas além do horizonte", () => {
    expect(desenhar(cena([nota(5)])).desenhos()).toHaveLength(0);
  });

  it("não desenha notas já acertadas", () => {
    const c = cena([nota(0.5)]);
    c.notas[0].acertada = true;
    expect(desenhar(c).desenhos()).toHaveLength(0);
  });

  it("notas de frase de star power usam o sprite de estrela, até a frase falhar", () => {
    expect(desenhar(cena([nota(0.5, 0, { frase: 2 })])).desenhos()[0]).toMatchObject({ estrela: true });
    expect(desenhar(cena([nota(0.5, 0, { frase: 2 })], { frasesFalhas: new Set([2]) })).desenhos()[0]).toMatchObject({ estrela: false });
  });

  it("com star power ativo todas as notas ficam azuis", () => {
    expect(desenhar(cena([nota(0.5, 4)], { estrelaAtiva: true })).desenhos()[0]).toMatchObject({ cor: COR_DA_ESTRELA });
  });

  it("acende o brilho dos trastes apertados só com efeitos ligados", () => {
    const apertado = cena([], { apertados: [true, false, false, false, false] });
    expect(desenhar(apertado).desenhos()).toEqual([{ tipo: "brilho", cor: CORES_DAS_PISTAS[0] }]);
    expect(desenhar(apertado, 0, false).desenhos()).toHaveLength(0);
  });

  it("desenha a explosão de acerto por 0,3 s", () => {
    const comExplosao = cena([], { explosoes: [{ pista: 2, tempo: 1 }] });
    expect(desenhar(comExplosao, 1.1).desenhos()).toHaveLength(1);
    expect(desenhar(comExplosao, 1.4).desenhos()).toHaveLength(0);
  });

  it("escreve ERRO em cima da tecla da nota perdida, por pouco tempo", () => {
    const comFalha = cena([], { falhas: [{ pista: 1, tempo: 1 }] });
    const textos = (t: number, efeitos = true) => desenhar(comFalha, t, efeitos).chamadas.filter((ch) => ch.metodo === "fillText");
    expect(textos(1.1).map((ch) => ch.args[0])).toEqual(["ERRO"]);
    expect(textos(1.1, false).map((ch) => ch.args[0])).toEqual(["ERRO"]);
    expect(textos(2)).toEqual([]);
  });

  it("não escreve o julgamento no braço, para não tapar as notas", () => {
    const textos = desenhar(cena([])).chamadas.filter((ch) => ch.metodo === "fillText");
    expect(textos).toEqual([]);
  });

  it("desenha o rastro do sustain de uma nota sendo segurada", () => {
    const c = cena([nota(0, 2, { duracao: 1 })]);
    c.notas[0].acertada = true;
    c.notas[0].segurando = true;
    const preenchimentos = desenhar(c, 0.5).chamadas.filter((ch) => ch.metodo === "fill").length;
    const semSustain = desenhar(cena([]), 0.5).chamadas.filter((ch) => ch.metodo === "fill").length;
    expect(preenchimentos).toBeGreaterThan(semSustain);
  });

  it("as cordas são de metal: sombra, borda, corpo e brilho em cada uma, e o enrolamento num traço só", () => {
    const vazia = desenhar(cena([])).chamadas;
    const preenchimentos = vazia.filter((ch) => ch.metodo === "fill").length;
    const cordas = 5 * 4;
    expect(preenchimentos).toBeGreaterThanOrEqual(cordas);
    // Cada volta do enrolamento é um segmento; todas saem num stroke só, para não pesar.
    expect(vazia.filter((ch) => ch.metodo === "moveTo").length).toBeGreaterThan(100);
  });

  it("cada batida vira um traste de metal, com brilho e sombra", () => {
    const tracos = (c: Cena) => desenhar(c, 0).chamadas.filter((ch) => ch.metodo === "stroke").length;
    expect(tracos(cena([], { batidas: [{ tempo: 0.5, forte: true }] })) - tracos(cena([]))).toBe(2);
  });

  it("as batidas fortes ganham uma marcação de madrepérola no braço, como numa guitarra", () => {
    const preenchimentos = (c: Cena) => desenhar(c, 0).chamadas.filter((ch) => ch.metodo === "fill").length;
    expect(preenchimentos(cena([], { batidas: [{ tempo: 0.5, forte: true }] }))).toBeGreaterThan(preenchimentos(cena([])));
    expect(preenchimentos(cena([], { batidas: [{ tempo: 0.5, forte: false }] }))).toBe(preenchimentos(cena([])));
  });

  it("o braço ganha a textura gasta, presa dentro do contorno da pista", () => {
    const chamadas = desenhar(cena([])).chamadas;
    const padrao = chamadas.find((ch) => ch.metodo === "createPattern");
    expect(padrao?.args).toEqual([{ tipo: "textura" }, "repeat"]);
    const recorte = chamadas.findIndex((ch) => ch.metodo === "clip");
    expect(recorte).toBeGreaterThan(-1);
    expect(chamadas.findIndex((ch) => ch.metodo === "restore")).toBeGreaterThan(recorte);
  });

  it("o fim do braço some num fade, apagando o que está desenhado perto do horizonte", () => {
    const chamadas = desenhar(cena([nota(1.9)])).chamadas;
    const apagar = chamadas.findIndex((ch) => ch.metodo === "=globalCompositeOperation" && ch.args[0] === "destination-out");
    const desenhoDaNota = chamadas.findIndex((ch) => ch.metodo === "drawImage");
    expect(apagar).toBeGreaterThan(desenhoDaNota);
    expect(chamadas.at(-1)).not.toEqual({ metodo: "=globalCompositeOperation", args: ["destination-out"] });
    expect(chamadas.filter((ch) => ch.metodo === "=globalCompositeOperation").at(-1)?.args[0]).toBe("source-over");
  });

  it("desenha os raios de um trovão por meio segundo", () => {
    const tracos = (c: Cena, tempo: number, efeitos = true) => desenhar(c, tempo, efeitos).chamadas.filter((ch) => ch.metodo === "stroke").length;
    const semTrovao = tracos(cena([]), 1.05);
    const comTrovao = cena([], { trovoes: [{ tempo: 1, forca: 2, semente: 9 }] });
    expect(tracos(comTrovao, 1.05)).toBeGreaterThan(semTrovao);
    expect(tracos(comTrovao, 1.8)).toBe(semTrovao);
    expect(tracos(comTrovao, 1.05, false)).toBe(tracos(cena([]), 1.05, false));
  });

  it("treme a pista logo depois de soltar o star power, só com efeitos ligados", () => {
    const tremendo = cena([], { estrelaAtiva: true, estrelaDesde: 1 });
    const deslocamentos = (c: Cena, tempo: number, efeitos = true) => desenhar(c, tempo, efeitos).chamadas.filter((ch) => ch.metodo === "translate").length;
    expect(deslocamentos(tremendo, 1.05)).toBeGreaterThan(0);
    expect(deslocamentos(tremendo, 3)).toBe(0);
    expect(deslocamentos(tremendo, 1.05, false)).toBe(0);
  });
});
