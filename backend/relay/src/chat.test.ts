import { BALDE_CHEIO, MENSAGENS_GUARDADAS, chaveDaMensagem, gastarDoBalde, lerTextoDoChat } from "./chat";

describe("lerTextoDoChat", () => {
  it("lê o texto e limpa como o app limpa", () => {
    expect(lerTextoDoChat(JSON.stringify({ texto: "  oi\n\ngente  " }))).toBe("oi gente");
  });

  it("corta no tamanho máximo e tira os invisíveis", () => {
    expect(lerTextoDoChat(JSON.stringify({ texto: "a".repeat(900) }))).toHaveLength(200);
    expect(lerTextoDoChat(JSON.stringify({ texto: "a‮b​c" }))).toBe("abc");
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
