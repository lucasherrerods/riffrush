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
