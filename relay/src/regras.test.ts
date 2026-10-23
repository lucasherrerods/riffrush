import { HOST, LIMITE_DE_MENSAGENS_POR_SEGUNDO, TAMANHO_MAXIMO_DA_MENSAGEM, codigoValido, dentroDoLimite, embrulhar, gerarCodigo, mensagemDoServidor } from "./regras";

describe("gerarCodigo", () => {
  it("gera 5 caracteres sem letras que se confundem", () => {
    const codigo = gerarCodigo(() => 0.99);
    expect(codigo).toHaveLength(5);
    expect(codigo).not.toMatch(/[IO01L]/);
  });

  it("usa o sorteio recebido", () => {
    expect(gerarCodigo(() => 0)).toBe("AAAAA");
  });
});

describe("codigoValido", () => {
  it("aceita só códigos no formato gerado", () => {
    expect(codigoValido(gerarCodigo(Math.random))).toBe(true);
    expect(codigoValido("abcde")).toBe(false);
    expect(codigoValido("AB")).toBe(false);
    expect(codigoValido("ABCD0")).toBe(false);
  });
});

describe("embrulhar", () => {
  it("embrulha a mensagem com quem mandou, igual ao servidor da LAN", () => {
    expect(embrulhar(3, '{"tipo":"oi"}')).toBe('{"de":3,"msg":{"tipo":"oi"}}');
  });

  it("não repassa o que não é JSON", () => {
    expect(embrulhar(1, "isso não é json")).toBeNull();
  });

  it("não repassa mensagens gigantes", () => {
    expect(embrulhar(1, JSON.stringify({ x: "a".repeat(TAMANHO_MAXIMO_DA_MENSAGEM) }))).toBeNull();
  });
});

describe("mensagemDoServidor", () => {
  it("o servidor fala com o id 0", () => {
    expect(JSON.parse(mensagemDoServidor({ tipo: "bemVindo", id: HOST, codigo: "ABCDE" }))).toEqual({ de: 0, msg: { tipo: "bemVindo", id: 1, codigo: "ABCDE" } });
  });

  it("avisa a saída em nome de quem saiu", () => {
    expect(JSON.parse(mensagemDoServidor({ tipo: "saiu" }, 2))).toEqual({ de: 2, msg: { tipo: "saiu" } });
  });
});

describe("dentroDoLimite", () => {
  it(`deixa passar até ${LIMITE_DE_MENSAGENS_POR_SEGUNDO} mensagens por segundo`, () => {
    let janela = { inicio: 0, contagem: 0 };
    for (let i = 0; i < LIMITE_DE_MENSAGENS_POR_SEGUNDO; i++) {
      const r = dentroDoLimite(janela, 500);
      expect(r.passa).toBe(true);
      janela = r.janela;
    }
    expect(dentroDoLimite(janela, 900).passa).toBe(false);
  });

  it("a contagem recomeça no segundo seguinte", () => {
    const cheia = { inicio: 0, contagem: LIMITE_DE_MENSAGENS_POR_SEGUNDO };
    expect(dentroDoLimite(cheia, 1000)).toEqual({ passa: true, janela: { inicio: 1000, contagem: 1 } });
  });
});
