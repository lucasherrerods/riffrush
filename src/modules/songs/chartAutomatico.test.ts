import { chartDoAudio } from "./chartAutomatico";

const TAXA = 22050;

/** Áudio de teste: silêncio com estalos curtos nos instantes pedidos. */
function audioComEstalos(segundos: number, estalos: { tempo: number; frequencia: number }[]) {
  const amostras = new Float32Array(segundos * TAXA);
  for (const { tempo, frequencia } of estalos) {
    const inicio = Math.floor(tempo * TAXA);
    for (let i = 0; i < 0.05 * TAXA; i++) {
      amostras[inicio + i] += Math.sin((2 * Math.PI * frequencia * i) / TAXA) * Math.exp(-i / (0.01 * TAXA));
    }
  }
  return amostras;
}

const estalos = [1, 1.5, 2, 2.5, 3, 4, 5].map((tempo, i) => ({ tempo, frequencia: [200, 2000, 400, 4000, 300, 1000, 6000][i] }));

describe("chartDoAudio", () => {
  it("cria uma nota em cada ataque do som", () => {
    const notas = chartDoAudio(audioComEstalos(6, estalos), TAXA, "expert");
    expect(notas).toHaveLength(estalos.length);
    notas.forEach((nota, i) => expect(Math.abs(nota.tempo - estalos[i].tempo)).toBeLessThan(0.05));
  });

  it("respeita o espaço mínimo entre notas da dificuldade", () => {
    const notas = chartDoAudio(audioComEstalos(6, estalos), TAXA, "facil");
    for (let i = 1; i < notas.length; i++) expect(notas[i].tempo - notas[i - 1].tempo).toBeGreaterThanOrEqual(0.5);
  });

  it("usa só as pistas da dificuldade", () => {
    const pistas = chartDoAudio(audioComEstalos(6, estalos), TAXA, "medio").map((n) => n.pista);
    expect(Math.max(...pistas)).toBeLessThan(4);
    expect(Math.min(...pistas)).toBeGreaterThanOrEqual(0);
  });

  it("põe sons agudos em pistas mais à direita que os graves", () => {
    const notas = chartDoAudio(audioComEstalos(6, estalos), TAXA, "expert");
    const grave = notas.find((n) => Math.abs(n.tempo - 1) < 0.05)!;
    const agudo = notas.find((n) => Math.abs(n.tempo - 5) < 0.05)!;
    expect(agudo.pista).toBeGreaterThan(grave.pista);
  });

  it("transforma em sustain as notas com espaço até a próxima", () => {
    const notas = chartDoAudio(audioComEstalos(6, estalos), TAXA, "expert");
    expect(notas.find((n) => Math.abs(n.tempo - 3) < 0.05)!.duracao).toBeGreaterThan(0);
  });

  it("não cria notas no silêncio", () => {
    expect(chartDoAudio(new Float32Array(3 * TAXA), TAXA, "expert")).toHaveLength(0);
  });
});
