import { DOCUMENTOS, documentoDoEndereco } from "./documentos";

describe("documentoDoEndereco", () => {
  it("reconhece os endereços das páginas legais, com ou sem barra no fim", () => {
    expect(documentoDoEndereco("/privacidade")).toBe("privacidade");
    expect(documentoDoEndereco("/termos/")).toBe("termos");
  });

  it("qualquer outro endereço é o jogo", () => {
    expect(documentoDoEndereco("/")).toBeNull();
    expect(documentoDoEndereco("/outra")).toBeNull();
  });
});

describe("DOCUMENTOS", () => {
  it("a política diz o que guarda e como pedir a exclusão", () => {
    const texto = JSON.stringify(DOCUMENTOS.privacidade);
    expect(texto).toContain("Google");
    expect(texto).toContain("Excluir minha conta");
  });

  it("a política e os termos falam do chat", () => {
    expect(JSON.stringify(DOCUMENTOS.privacidade)).toContain("chat global");
    expect(JSON.stringify(DOCUMENTOS.termos)).toContain("selo Equipe");
  });
});
