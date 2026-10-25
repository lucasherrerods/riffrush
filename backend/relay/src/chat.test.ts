import { BALDE_CHEIO, MENSAGENS_GUARDADAS, NIVEL_PARA_ESCREVER, RETENCAO_MS, chaveDaMensagem, gastarDoBalde, lerAvisoDaApi, lerComando, lerTextoDoChat, nomeParaMostrar, podeEscrever, recentes } from "./chat";

describe("lerTextoDoChat", () => {
  it("lê o texto e limpa como o app limpa", () => {
    expect(lerTextoDoChat(JSON.stringify({ texto: "  oi\n\ngente  " }))).toBe("oi gente");
  });

  it("corta no tamanho máximo e tira os invisíveis", () => {
    expect(lerTextoDoChat(JSON.stringify({ texto: "a".repeat(900) }))).toHaveLength(200);
    expect(lerTextoDoChat(JSON.stringify({ texto: "a\u202Eb\u200Bc" }))).toBe("abc");
  });

  it("recusa o que não é uma mensagem de chat", () => {
    expect(lerTextoDoChat("isso não é json")).toBeNull();
    expect(lerTextoDoChat(JSON.stringify({ texto: 5 }))).toBeNull();
    expect(lerTextoDoChat(JSON.stringify({ texto: "   " }))).toBeNull();
    expect(lerTextoDoChat(JSON.stringify(null))).toBeNull();
  });

  it("recusa mensagem bruta grande demais sem nem ler", () => {
    expect(lerTextoDoChat(JSON.stringify({ texto: "a".repeat(5000) }))).toBeNull();
  });
});

describe("gastarDoBalde", () => {
  it("rajada de 5, depois uma por segundo", () => {
    let balde = BALDE_CHEIO;
    let passaram = 0;
    for (let i = 0; i < 10; i++) {
      const r = gastarDoBalde(balde, 1000);
      balde = r.balde;
      if (r.passa) passaram++;
    }
    expect(passaram).toBe(5);
    expect(gastarDoBalde(balde, 2000).passa).toBe(true);
  });
});

describe("chaveDaMensagem", () => {
  it("chaves em ordem de chegada, e a que sai é a de 50 mensagens atrás", () => {
    expect(chaveDaMensagem(7)).toBe("msg:00000007");
    expect(chaveDaMensagem(7) < chaveDaMensagem(12)).toBe(true);
    expect(MENSAGENS_GUARDADAS).toBe(50);
  });
});

describe("lerComando", () => {
  it("texto sem tipo é mensagem, das versões antigas do app", () => {
    expect(lerComando(JSON.stringify({ texto: " oi " }))).toEqual({ tipo: "mensagem", texto: "oi" });
    expect(lerComando(JSON.stringify({ tipo: "mensagem", texto: "oi" }))).toEqual({ tipo: "mensagem", texto: "oi" });
  });

  it("lê denúncia e o apagar da moderação; banir é com a API, não pelo chat", () => {
    expect(lerComando(JSON.stringify({ tipo: "denunciar", n: 4 }))).toEqual({ tipo: "denunciar", n: 4 });
    expect(lerComando(JSON.stringify({ tipo: "apagar", n: 4 }))).toEqual({ tipo: "apagar", n: 4 });
    expect(lerComando(JSON.stringify({ tipo: "banir", id: "00000000-0000-0000-0000-000000000007" }))).toBeNull();
  });

  it("recusa o resto", () => {
    expect(lerComando(JSON.stringify({ tipo: "denunciar", n: "4" }))).toBeNull();
    expect(lerComando(JSON.stringify({ tipo: "virarAdmin" }))).toBeNull();
    expect(lerComando("lixo")).toBeNull();
  });
});

describe("quem pode o quê", () => {
  it("escreve quem tem o nível mínimo e não está banido; admin sempre", () => {
    expect(NIVEL_PARA_ESCREVER).toBe(2);
    expect(podeEscrever({ nivel: 2, admin: false, banido: false })).toBe(true);
    expect(podeEscrever({ nivel: 1, admin: false, banido: false })).toBe(false);
    expect(podeEscrever({ nivel: 50, admin: false, banido: true })).toBe(false);
    expect(podeEscrever({ nivel: 0, admin: true, banido: false })).toBe(true);
  });

  it("nome que finge ser da moderação ganha um aviso, menos para quem é da moderação", () => {
    expect(nomeParaMostrar("Equipe Riff Rush", false)).toBe("Equipe Riff Rush (não oficial)");
    expect(nomeParaMostrar("ADM1N", false)).toBe("ADM1N (não oficial)");
    expect(nomeParaMostrar("Mod3rador", false)).toBe("Mod3rador (não oficial)");
    expect(nomeParaMostrar("Súpórte", false)).toBe("Súpórte (não oficial)");
    expect(nomeParaMostrar("Equipe Riff Rush", true)).toBe("Equipe Riff Rush");
    expect(nomeParaMostrar("Lucas Herrero", false)).toBe("Lucas Herrero");
  });
});

describe("recentes", () => {
  it("só as mensagens das últimas 24 horas", () => {
    const agora = 10 * RETENCAO_MS;
    const m = (n: number, em: number) => ({ n, autor: { id: "a", nome: "A" }, texto: "x", em });
    expect(recentes([m(1, agora - RETENCAO_MS - 1), m(2, agora - 1000)], agora).map((x) => x.n)).toEqual([2]);
  });
});

describe("lerAvisoDaApi", () => {
  it("lê o banir e o desbanir que a API manda", () => {
    const id = "00000000-0000-0000-0000-000000000007";
    expect(lerAvisoDaApi(JSON.stringify({ tipo: "banir", id }))).toEqual({ tipo: "banir", id });
    expect(lerAvisoDaApi(JSON.stringify({ tipo: "desbanir", id }))).toEqual({ tipo: "desbanir", id });
    expect(lerAvisoDaApi(JSON.stringify({ tipo: "banir", id: "../x" }))).toBeNull();
    expect(lerAvisoDaApi("lixo")).toBeNull();
  });
});
