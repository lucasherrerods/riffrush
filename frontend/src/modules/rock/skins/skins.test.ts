import { SKIN_PADRAO, SKINS_PRONTAS, skinPorId } from "./skins";
import type { SkinDaPista } from "./skins";

const importada: SkinDaPista = { ...SKIN_PADRAO, id: "highway:minha", nome: "Minha", highway: "data:image/jpeg;base64,..." };

describe("skins prontas", () => {
  it("tem pelo menos três, com ids únicos", () => {
    expect(SKINS_PRONTAS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(SKINS_PRONTAS.map((s) => s.id)).size).toBe(SKINS_PRONTAS.length);
  });

  it("cada uma tem o tom do braço; as cores das notas ficam nas caçapas", () => {
    for (const skin of SKINS_PRONTAS) {
      expect(skin.cores.braco).toMatch(/^#/);
      expect(skin.cores).not.toHaveProperty("trastes");
    }
  });

  it("a padrão é a primeira e não tem imagem", () => {
    expect(SKINS_PRONTAS[0]).toBe(SKIN_PADRAO);
    expect(SKIN_PADRAO.highway).toBeUndefined();
  });
});

describe("pistas dos personagens", () => {
  it("cada personagem com card vira uma pista pronta, com a arte dele recortada", () => {
    const dosPersonagens = SKINS_PRONTAS.filter((s) => s.id.startsWith("personagem:"));
    expect(dosPersonagens.length).toBeGreaterThanOrEqual(2);
    for (const skin of dosPersonagens) {
      expect(skin.highway).toMatch(/card\.webp$/);
      expect(skin.recortar).toBe(true);
    }
  });

  it("as importadas não são recortadas de novo: já foram salvas em 512x1024", () => {
    expect(importada.recortar).toBeUndefined();
  });
});

describe("skinPorId", () => {
  it("acha uma skin pronta", () => {
    expect(skinPorId(SKINS_PRONTAS[1].id, [])).toBe(SKINS_PRONTAS[1]);
  });

  it("acha uma highway importada", () => {
    expect(skinPorId("highway:minha", [importada])).toBe(importada);
  });

  it("volta para a padrão quando o id não existe mais", () => {
    expect(skinPorId("highway:apagada", [importada])).toBe(SKIN_PADRAO);
  });
});
