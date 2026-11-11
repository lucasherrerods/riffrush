import { scriptDoFundoInicial } from "./fundoInicial";

const rodar = (script: string, salvo: string | null, lancar = false) => {
  const estilo: Record<string, string> = {};
  const ambiente = {
    localStorage: { getItem: () => (lancar ? (() => { throw new Error("sem armazenamento"); })() : salvo) },
    document: { documentElement: { style: estilo } },
  };
  new Function("localStorage", "document", script)(ambiente.localStorage, ambiente.document);
  return estilo.backgroundColor;
};

describe("scriptDoFundoInicial", () => {
  const script = scriptDoFundoInicial({ rock: "#111111", mania: "#222222" }, "riffrush.modo");

  it("pinta o fundo com a cor do modo salvo, antes do app carregar", () => {
    expect(rodar(script, "mania")).toBe("#222222");
    expect(rodar(script, "rock")).toBe("#111111");
  });

  it("sem modo salvo, ou sem armazenamento, usa o Rock", () => {
    expect(rodar(script, null)).toBe("#111111");
    expect(rodar(script, "outro")).toBe("#111111");
    expect(rodar(script, null, true)).toBe("#111111");
  });
});
