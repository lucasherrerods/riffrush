import { aplicarTokens, brilho, comAlfa, croma } from "./tokens";
import { TEMAS, TEMA_PADRAO, type Tema } from "./temas";

const { cores } = TEMA_PADRAO;

/** Contraste WCAG entre duas cores hex. */
function contraste(a: string, b: string) {
  const luminancia = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

describe.each(Object.values(TEMAS as Record<string, Tema>).map((tema) => [tema.nome, tema] as const))("tema %s (regras de docs/design.md)", (_, tema) => {
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

  it("neutros têm uma única temperatura (todos frios ou todos quentes)", () => {
    const temperaturas = neutros.map((cor) => Math.sign(parseInt(cor.slice(1, 3), 16) - parseInt(cor.slice(5, 7), 16)));
    expect(temperaturas.includes(1) && temperaturas.includes(-1)).toBe(false);
  });

  const claro = tema.esquema === "claro";

  it("superfícies ficam mais claras conforme a elevação, até 12% (escuro) ou 7% (claro) acima do fundo", () => {
    expect(brilho(cores.superficie)).toBeGreaterThan(brilho(cores.fundo));
    expect(brilho(cores.superficieElevada)).toBeGreaterThan(brilho(cores.superficie));
    expect(brilho(cores.superficieElevada) - brilho(cores.fundo)).toBeLessThanOrEqual(claro ? 0.07 : 0.12);
  });

  it("a borda contrasta com o fundo e as superfícies: mais clara no escuro, mais escura no claro", () => {
    if (claro) expect(brilho(cores.borda)).toBeLessThan(brilho(cores.fundo));
    else expect(brilho(cores.borda)).toBeGreaterThan(brilho(cores.superficieElevada));
  });

  it("o texto principal tem alto contraste com o fundo", () => {
    expect(Math.abs(brilho(cores.texto) - brilho(cores.fundo))).toBeGreaterThanOrEqual(0.8);
  });

  it("texto e texto suave passam no contraste AA (4,5:1) sobre o fundo e as superfícies", () => {
    for (const texto of [cores.texto, cores.textoSuave])
      for (const fundo of [cores.fundo, cores.superficie, cores.superficieElevada]) expect(contraste(texto, fundo)).toBeGreaterThanOrEqual(4.5);
  });

  it("as cores da paleta têm brilhos distintos", () => {
    const brilhos = paleta.map(brilho).sort((a, b) => a - b);
    for (let i = 1; i < brilhos.length; i++) expect(brilhos[i] - brilhos[i - 1]).toBeGreaterThanOrEqual(0.06);
  });

  it("a skin da pista tem uma cor para cada um dos 5 trastes", () => {
    expect(tema.pista.trastes).toHaveLength(5);
  });
});

describe("tema padrão", () => {
  it("é o Riff Rush, com as cores da logo", () => {
    expect(TEMA_PADRAO.nome).toBe("Riff Rush");
    expect(cores.texto).toBe("#e8e4dc");
    expect(cores.primaria).toBe("#e3191f");
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
