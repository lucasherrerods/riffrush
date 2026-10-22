import { aplicarTokens, brilho, comAlfa, croma, cores, paleta } from "./tokens";
import { TEMAS, temaAtivo } from "./temas";

describe.each(Object.values(TEMAS).map((tema) => [tema.nome, tema] as const))("tema %s (regras de docs/design.md)", (_, tema) => {
  const { cores } = tema;
  const neutros = [cores.fundo, cores.superficie, cores.superficieElevada, cores.borda, cores.texto, cores.textoSuave];
  const paleta = [cores.primaria, cores.sucesso, cores.perigo, cores.destaque];

  it("não usa preto nem branco puros", () => {
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
    const brilhos = paleta.map(brilho).sort((a, b) => a - b);
    for (let i = 1; i < brilhos.length; i++) expect(brilhos[i] - brilhos[i - 1]).toBeGreaterThanOrEqual(0.06);
  });

  it("a skin da pista tem uma cor para cada um dos 5 trastes", () => {
    expect(tema.pista.trastes).toHaveLength(5);
  });
});

describe("tema ativo", () => {
  it("é o Crimson Noir", () => {
    expect(temaAtivo.nome).toBe("Crimson Noir");
    expect(cores.fundo).toBe("#0b0b0d");
    expect(paleta.primaria).toBe("#c1121f");
  });
});

describe("comAlfa", () => {
  it("converte hex em rgba com transparência", () => {
    expect(comAlfa("#0b0b0d", 0.5)).toBe("rgba(11,11,13,0.5)");
  });

  it("não deixa a transparência ficar negativa", () => {
    expect(comAlfa("#ffffff", -1)).toBe("rgba(255,255,255,0)");
  });
});

describe("aplicarTokens", () => {
  it("publica as cores do tema como variáveis CSS na raiz", () => {
    aplicarTokens(document.documentElement);
    expect(document.documentElement.style.getPropertyValue("--cor-fundo")).toBe(cores.fundo);
    expect(document.documentElement.style.getPropertyValue("--cor-superficie-elevada")).toBe(cores.superficieElevada);
    expect(document.documentElement.style.getPropertyValue("--cor-ouro")).toBe(cores.ouro);
  });

  it("aceita outro tema", () => {
    aplicarTokens(document.documentElement, TEMAS.synthwave);
    expect(document.documentElement.style.getPropertyValue("--cor-primaria")).toBe(TEMAS.synthwave.cores.primaria);
    aplicarTokens(document.documentElement);
  });
});
