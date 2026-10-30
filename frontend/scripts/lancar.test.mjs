import { describe, expect, it } from "vitest";
import { trocarVersaoNoCargo, trocarVersaoNoJson, versaoValida } from "./lancar.mjs";

describe("lancar", () => {
  it("aceita só versões x.y.z", () => {
    expect(versaoValida("0.2.0")).toBe(true);
    expect(versaoValida("v0.2.0")).toBe(false);
    expect(versaoValida("0.2")).toBe(false);
  });

  it("troca a versão do json sem mexer no resto", () => {
    const json = '{\n  "name": "x",\n  "version": "0.1.0"\n}\n';
    expect(trocarVersaoNoJson(json, "0.2.0")).toBe('{\n  "name": "x",\n  "version": "0.2.0"\n}\n');
  });

  it("troca só a versão do pacote no Cargo.toml", () => {
    const cargo = '[package]\nname = "riff-rush"\nversion = "0.1.0"\n\n[dependencies]\ntauri = { version = "2" }\n';
    expect(trocarVersaoNoCargo(cargo, "0.2.0")).toBe('[package]\nname = "riff-rush"\nversion = "0.2.0"\n\n[dependencies]\ntauri = { version = "2" }\n');
  });
});
