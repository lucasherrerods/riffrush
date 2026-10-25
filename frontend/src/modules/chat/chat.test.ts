import { TAMANHO_MAXIMO_DO_TEXTO, adicionarMensagem, gastarDoBalde, limparTexto, BALDE_CHEIO } from "./chat";

describe("limparTexto", () => {
  it("tira espaços das pontas e junta quebras de linha num espaço só", () => {
    expect(limparTexto("  oi\n\n  tudo   bem?  ")).toBe("oi tudo bem?");
  });

  it("vazio ou que não é texto não vira mensagem", () => {
    expect(limparTexto("   ")).toBeNull();
    expect(limparTexto(42)).toBeNull();
    expect(limparTexto(undefined)).toBeNull();
  });

  it("corta no tamanho máximo", () => {
    expect(limparTexto("a".repeat(500))).toHaveLength(TAMANHO_MAXIMO_DO_TEXTO);
  });

  it("tira caracteres de controle e os que invertem a direção do texto ou ficam invisíveis", () => {
    expect(limparTexto("a\u0000b‮c⁦d​e﻿f")).toBe("abcdef");
  });
});

describe("gastarDoBalde", () => {
  it("deixa uma rajada curta e depois uma mensagem por segundo", () => {
    let balde = BALDE_CHEIO;
    const passaram = [];
    for (let i = 0; i < 8; i++) {
      const r = gastarDoBalde(balde, 1000);
      balde = r.balde;
      passaram.push(r.passa);
    }
    expect(passaram.filter(Boolean)).toHaveLength(5);
    expect(gastarDoBalde(balde, 1999).passa).toBe(false);
    expect(gastarDoBalde(balde, 2000).passa).toBe(true);
  });

  it("parado, o balde enche só até a rajada", () => {
    let balde = gastarDoBalde(BALDE_CHEIO, 0).balde;
    let passaram = 0;
    for (let i = 0; i < 10; i++) {
      const r = gastarDoBalde(balde, 60_000);
      balde = r.balde;
      if (r.passa) passaram++;
    }
    expect(passaram).toBe(5);
  });
});

describe("adicionarMensagem", () => {
  it("guarda só as últimas", () => {
    let lista: number[] = [];
    for (let i = 0; i < 60; i++) lista = adicionarMensagem(lista, i, 50);
    expect(lista).toHaveLength(50);
    expect(lista[0]).toBe(10);
    expect(lista.at(-1)).toBe(59);
  });
});
