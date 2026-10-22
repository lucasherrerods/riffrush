import { aplicarTokens, brilho, croma, cores, paleta } from "./tokens";

const neutros = [cores.fundo, cores.superficie, cores.superficieElevada, cores.borda, cores.texto, cores.textoSuave];

describe("tokens de cor (regras de docs/design.md)", () => {
  it("não usam preto nem branco puros", () => {
    for (const cor of Object.values(cores)) {
      expect(cor.toLowerCase()).not.toBe("#000000");
      expect(cor.toLowerCase()).not.toBe("#ffffff");
    }
  });

  it("neutros são levemente tingidos (croma de até 5%)", () => {
    for (const cor of neutros) expect(croma(cor)).toBeLessThanOrEqual(0.05);
  });

  it("neutros têm uma única temperatura (fria)", () => {
    for (const cor of neutros) {
      const azul = parseInt(cor.slice(5, 7), 16);
      const vermelho = parseInt(cor.slice(1, 3), 16);
      expect(azul).toBeGreaterThanOrEqual(vermelho);
    }
  });

  it("superfícies ficam mais claras conforme a elevação, até 12% acima do fundo", () => {
    expect(brilho(cores.superficie)).toBeGreaterThan(brilho(cores.fundo));
    expect(brilho(cores.superficieElevada)).toBeGreaterThan(brilho(cores.superficie));
    expect(brilho(cores.superficieElevada) - brilho(cores.fundo)).toBeLessThanOrEqual(0.12);
  });

  it("a borda é mais clara que o fundo e as superfícies", () => {
    expect(brilho(cores.borda)).toBeGreaterThan(brilho(cores.superficieElevada));
  });

  it("o texto principal tem alto contraste com o fundo", () => {
    expect(brilho(cores.texto) - brilho(cores.fundo)).toBeGreaterThanOrEqual(0.8);
  });

  it("as cores da paleta têm brilhos distintos", () => {
    const brilhos = Object.values(paleta).map(brilho).sort((a, b) => a - b);
    for (let i = 1; i < brilhos.length; i++) expect(brilhos[i] - brilhos[i - 1]).toBeGreaterThanOrEqual(0.06);
  });
});

describe("aplicarTokens", () => {
  it("publica as cores como variáveis CSS na raiz", () => {
    aplicarTokens(document.documentElement);
    expect(document.documentElement.style.getPropertyValue("--cor-fundo")).toBe(cores.fundo);
    expect(document.documentElement.style.getPropertyValue("--cor-primaria")).toBe(cores.primaria);
  });
});
