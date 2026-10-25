import { DURACAO, DURACAO_TOTAL, capasDaAbertura, corteNoTempo, deveMostrarAbertura, marcarAberturaVista, roteiroDaAbertura, vermelhoNoTempo } from "./roteiro";

beforeEach(() => localStorage.clear());

describe("capasDaAbertura", () => {
  it("põe as imagens primeiro, sem repetir, e completa com gradientes", () => {
    const capas = capasDaAbertura(
      [
        { capa: ["#000", "#111"] },
        { imagemDeCapa: "blob:a", capa: ["#222", "#333"] },
        { imagemDeCapa: "blob:a", capa: ["#444", "#555"] },
      ],
      4,
    );
    expect(capas).toEqual([
      { tipo: "imagem", url: "blob:a" },
      { tipo: "gradiente", cores: ["#000", "#111"] },
      { tipo: "gradiente", cores: ["#222", "#333"] },
      { tipo: "gradiente", cores: ["#444", "#555"] },
    ]);
  });

  it("sem música nenhuma, ainda tem capas", () => {
    expect(capasDaAbertura([], 8)).toHaveLength(8);
  });

  it("com imagens de sobra, não mistura gradientes", () => {
    const musicas = Array.from({ length: 20 }, (_, i) => ({ imagemDeCapa: `blob:${i}`, capa: ["#000", "#111"] as [string, string] }));
    expect(capasDaAbertura(musicas).every((c) => c.tipo === "imagem")).toBe(true);
  });
});

describe("roteiroDaAbertura", () => {
  const cortes = roteiroDaAbertura(10, 42);

  it("cobre a abertura inteira, cada vez mais rápido", () => {
    expect(cortes[0].inicio).toBe(0);
    expect(cortes.at(-1)!.inicio).toBeLessThan(DURACAO_TOTAL);
    const primeiro = cortes[1].inicio - cortes[0].inicio;
    const fim = cortes.findIndex((c) => c.inicio >= DURACAO.cortes);
    expect(cortes[fim].inicio - cortes[fim - 1].inicio).toBeLessThan(primeiro / 3);
  });

  it("nunca repete a mesma capa seguida", () => {
    for (let i = 1; i < cortes.length; i++) expect(cortes[i].capa).not.toBe(cortes[i - 1].capa);
  });

  it("a mesma semente monta a mesma abertura", () => {
    expect(roteiroDaAbertura(10, 42)).toEqual(cortes);
  });

  it("acha o corte de cada instante", () => {
    expect(corteNoTempo(cortes, 0)).toBe(cortes[0]);
    expect(corteNoTempo(cortes, cortes[3].inicio + 0.001)).toBe(cortes[3]);
  });
});

describe("vermelhoNoTempo", () => {
  it("começa sem vermelho e está todo vermelho quando o nome entra", () => {
    expect(vermelhoNoTempo(0)).toBe(0);
    expect(vermelhoNoTempo(DURACAO.cortes)).toBe(1);
    expect(vermelhoNoTempo(DURACAO.cortes * 0.7)).toBeGreaterThan(0);
  });
});

describe("deveMostrarAbertura", () => {
  it("mostra uma vez por dia", () => {
    const hoje = new Date(2026, 9, 25, 10);
    expect(deveMostrarAbertura(hoje)).toBe(true);
    marcarAberturaVista(hoje);
    expect(deveMostrarAbertura(new Date(2026, 9, 25, 22))).toBe(false);
    expect(deveMostrarAbertura(new Date(2026, 9, 26, 8))).toBe(true);
  });
});
