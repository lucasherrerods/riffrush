import { describe, expect, it } from "vitest";
import { lerConversa, marcarComoLida, receberPrivada, totalDeNaoLidas, type Conversas } from "./conversas";

const ana = { id: "ana", nome: "Ana", avatar: null };
const eu = { id: "eu", nome: "Eu", avatar: null };
const amigos = new Set(["ana"]);

describe("receberPrivada", () => {
  it("guarda a mensagem do amigo na conversa com ele e conta como não lida", () => {
    const conversas = receberPrivada({}, { de: ana, para: "eu", texto: "oi", em: 1 }, amigos);
    expect(lerConversa(conversas, "ana").mensagens).toEqual([{ de: ana, para: "eu", texto: "oi", em: 1, minha: false }]);
    expect(lerConversa(conversas, "ana").naoLidas).toBe(1);
  });

  it("a minha mensagem, que volta do relay, entra na conversa com quem recebeu sem contar como não lida", () => {
    const conversas = receberPrivada({}, { de: eu, para: "ana", texto: "bora", em: 2 }, amigos);
    expect(lerConversa(conversas, "ana").mensagens[0].minha).toBe(true);
    expect(lerConversa(conversas, "ana").naoLidas).toBe(0);
  });

  it("descarta mensagem de quem não é amigo", () => {
    expect(receberPrivada({}, { de: { id: "estranho", nome: "X", avatar: null }, para: "eu", texto: "oi", em: 1 }, amigos)).toEqual({});
  });

  it("guarda só as últimas 50 mensagens de cada conversa", () => {
    let conversas: Conversas = {};
    for (let i = 0; i < 60; i++) conversas = receberPrivada(conversas, { de: ana, para: "eu", texto: `m${i}`, em: i }, amigos);
    expect(lerConversa(conversas, "ana").mensagens).toHaveLength(50);
    expect(lerConversa(conversas, "ana").mensagens[0].texto).toBe("m10");
  });
});

describe("marcarComoLida e totalDeNaoLidas", () => {
  it("zera as não lidas de uma conversa e soma as de todas", () => {
    let conversas = receberPrivada({}, { de: ana, para: "eu", texto: "oi", em: 1 }, new Set(["ana", "bia"]));
    conversas = receberPrivada(conversas, { de: { id: "bia", nome: "Bia", avatar: null }, para: "eu", texto: "oi", em: 2 }, new Set(["ana", "bia"]));
    expect(totalDeNaoLidas(conversas)).toBe(2);
    conversas = marcarComoLida(conversas, "ana");
    expect(lerConversa(conversas, "ana").naoLidas).toBe(0);
    expect(totalDeNaoLidas(conversas)).toBe(1);
  });

  it("conversa que não existe aparece vazia", () => {
    expect(lerConversa({}, "ninguem")).toEqual({ mensagens: [], naoLidas: 0 });
  });
});
