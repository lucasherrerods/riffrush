import { describe, expect, it } from "vitest";
import { definirNaoLidas, juntarHistorico, lerConversa, marcarComoLida, receberPrivada, totalDeNaoLidas, type Conversas } from "./conversas";

const ana = { id: "ana", nome: "Ana", avatar: null };
const eu = { id: "eu", nome: "Eu", avatar: null };

describe("receberPrivada", () => {
  it("guarda a mensagem do amigo na conversa com ele e conta como não lida", () => {
    const conversas = receberPrivada({}, { id: 1, de: ana, para: "eu", texto: "oi", em: 10 }, "eu");
    expect(lerConversa(conversas, "ana").mensagens).toEqual([{ id: 1, de: "ana", texto: "oi", em: 10 }]);
    expect(lerConversa(conversas, "ana").naoLidas).toBe(1);
  });

  it("a minha, que volta do relay, entra na conversa com quem recebeu sem contar como não lida", () => {
    const conversas = receberPrivada({}, { id: 2, de: eu, para: "ana", texto: "bora", em: 20 }, "eu");
    expect(lerConversa(conversas, "ana").mensagens).toHaveLength(1);
    expect(lerConversa(conversas, "ana").naoLidas).toBe(0);
  });

  it("a mesma mensagem duas vezes (resposta da API e cópia do relay) entra uma vez só", () => {
    let conversas = receberPrivada({}, { id: 3, de: ana, para: "eu", texto: "oi", em: 10 }, "eu");
    conversas = receberPrivada(conversas, { id: 3, de: ana, para: "eu", texto: "oi", em: 10 }, "eu");
    expect(lerConversa(conversas, "ana").mensagens).toHaveLength(1);
    expect(lerConversa(conversas, "ana").naoLidas).toBe(1);
  });
});

describe("juntarHistorico", () => {
  it("junta o histórico da API com o que já chegou, em ordem e sem repetir", () => {
    let conversas = receberPrivada({}, { id: 5, de: ana, para: "eu", texto: "novo", em: 50 }, "eu");
    conversas = juntarHistorico(conversas, "ana", [
      { id: 5, de: "ana", para: "eu", texto: "novo", enviada_em: "2026-11-09T12:00:00Z" },
      { id: 2, de: "eu", para: "ana", texto: "velho", enviada_em: "2026-11-09T11:00:00Z" },
    ]);
    const { mensagens } = lerConversa(conversas, "ana");
    expect(mensagens.map((m) => m.texto)).toEqual(["velho", "novo"]);
    expect(mensagens[0].em).toBe(Date.parse("2026-11-09T11:00:00Z"));
    expect(lerConversa(conversas, "ana").carregada).toBe(true);
  });
});

describe("não lidas", () => {
  it("a contagem vem da API, zera ao ler e soma as de todos", () => {
    let conversas: Conversas = definirNaoLidas({}, [
      { conta_id: "ana", quantas: 2 },
      { conta_id: "bia", quantas: 1 },
    ]);
    expect(totalDeNaoLidas(conversas)).toBe(3);
    conversas = marcarComoLida(conversas, "ana");
    expect(lerConversa(conversas, "ana").naoLidas).toBe(0);
    expect(totalDeNaoLidas(conversas)).toBe(1);
  });

  it("conversa que não existe aparece vazia e sem carregar", () => {
    expect(lerConversa({}, "ninguem")).toEqual({ mensagens: [], naoLidas: 0, carregada: false });
  });
});
