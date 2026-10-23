import { MUSICAS_EMBUTIDAS, type Musica } from "@/modules/songs";
import { INTERVALO_DO_ESTADO_ONLINE_MS, deveEnviarEstado, normalizarCodigo, podeTocarOnline, urlParaCriarSala, urlParaEntrarNaSala } from "./online";

const estado = { pontos: 10, vida: 0.5, sequencia: 1, pulso: 1, derrota: false, terminou: false };

describe("endereços do relay", () => {
  it("monta as rotas a partir da URL configurada, com ou sem barra no fim", () => {
    expect(urlParaCriarSala("wss://relay.exemplo.dev/")).toBe("wss://relay.exemplo.dev/criar");
    expect(urlParaEntrarNaSala("wss://relay.exemplo.dev", "ABCDE")).toBe("wss://relay.exemplo.dev/sala/ABCDE");
  });
});

describe("normalizarCodigo", () => {
  it("aceita minúsculas, espaços e traço", () => {
    expect(normalizarCodigo(" ab-c de ")).toBe("ABCDE");
  });

  it("recusa o que não pode ser um código", () => {
    expect(normalizarCodigo("ABC")).toBeNull();
    expect(normalizarCodigo("ABCD0")).toBeNull();
  });
});

describe("deveEnviarEstado", () => {
  it(`no online, manda no máximo um placar a cada ${INTERVALO_DO_ESTADO_ONLINE_MS} ms`, () => {
    expect(deveEnviarEstado(0, INTERVALO_DO_ESTADO_ONLINE_MS - 1, estado)).toBe(false);
    expect(deveEnviarEstado(0, INTERVALO_DO_ESTADO_ONLINE_MS, estado)).toBe(true);
  });

  it("o fim da partida sempre vai na hora", () => {
    expect(deveEnviarEstado(0, 1, { ...estado, terminou: true })).toBe(true);
    expect(deveEnviarEstado(0, 1, { ...estado, derrota: true })).toBe(true);
  });
});

describe("podeTocarOnline", () => {
  const importada: Musica = { ...MUSICAS_EMBUTIDAS[0], id: "arquivo:x.wav:1", arquivo: new File(["x"], "x.wav") };

  it("embutidas e baixadas do Encore podem: todo mundo consegue a mesma música", () => {
    expect(podeTocarOnline(MUSICAS_EMBUTIDAS[0])).toBe(true);
    expect(podeTocarOnline({ ...importada, urlDoEncore: "https://files.enchor.us/a.sng" })).toBe(true);
  });

  it("arquivo importado do PC não pode: ele teria que passar pelo relay", () => {
    expect(podeTocarOnline(importada)).toBe(false);
  });
});
