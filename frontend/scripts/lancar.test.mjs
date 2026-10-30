import { describe, expect, it } from "vitest";
import { montarLatestJson, trocarVersaoNoCargo, trocarVersaoNoJson, versaoValida } from "./lancar.mjs";

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

  it("monta o latest.json do updater apontando para o instalador da tag", () => {
    const json = JSON.parse(montarLatestJson("0.2.0", "assinatura", new Date("2026-10-29T12:00:00Z")));
    expect(json).toEqual({
      version: "0.2.0",
      pub_date: "2026-10-29T12:00:00.000Z",
      platforms: {
        "windows-x86_64": {
          signature: "assinatura",
          url: "https://github.com/lucasherrerods/riffrush/releases/download/v0.2.0/RiffRush-setup.exe",
        },
      },
    });
  });
});
