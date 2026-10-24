// Se alguém importar o three.js direto da API pública, o 3D volta para o pacote inicial e a abertura fica lenta.
vi.mock("three", () => {
  throw new Error("o three.js foi carregado na abertura");
});

describe("carregamento do 3D", () => {
  it("o módulo do personagem e o do palco abrem sem baixar o three.js", async () => {
    await expect(import("@/modules/character")).resolves.toBeDefined();
    await expect(import("@/modules/stage")).resolves.toBeDefined();
    // Importar os módulos inteiros demora com a suíte toda rodando junto.
  }, 30000);
});
