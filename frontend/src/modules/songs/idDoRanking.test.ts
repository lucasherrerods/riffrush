import { MUSICAS_DE_TESTE } from "@/test/musicas";
import { idDoRanking, nomeDaMusica, tituloDaMusica } from "./idDoRanking";

describe("idDoRanking", () => {
  it("música do jogo usa o próprio id, igual em todo aparelho", () => {
    expect(idDoRanking(MUSICAS_DE_TESTE[0])).toBe(MUSICAS_DE_TESTE[0].id);
  });

  // O id local de uma importada leva o nome do arquivo: quem baixou o mesmo chart cairia em rankings diferentes.
  it("música do Encore usa o md5 do chart, igual para todo mundo que baixou", () => {
    const baixada = { ...MUSICAS_DE_TESTE[0], id: "arquivo:Banda - Hit.sng:123", md5DoEncore: "8d63" };
    expect(idDoRanking(baixada)).toBe("encore:8d63");
  });
});

describe("tituloDaMusica", () => {
  it("acha a música pelo id do ranking, inclusive as do Encore", () => {
    const baixada = { ...MUSICAS_DE_TESTE[0], titulo: "Hit", artista: "Banda", md5DoEncore: "8d63" };
    expect(tituloDaMusica([baixada], "encore:8d63")).toBe("Hit — Banda");
  });

  it("sem artista mostra só o título, e música que não está na lista não tem título", () => {
    const semArtista = { ...MUSICAS_DE_TESTE[0], titulo: "Solo", artista: "" };
    expect(tituloDaMusica([semArtista], semArtista.id)).toBe("Solo");
    expect(tituloDaMusica([semArtista], "outra")).toBeUndefined();
  });
});

describe("nomeDaMusica", () => {
  const semBiblioteca = () => undefined;

  it("a biblioteca vem primeiro", () => {
    expect(nomeDaMusica({ musica_id: "spektrem-shine", titulo: "Outro" }, () => "Shine — Spektrem")).toBe("Shine — Spektrem");
  });

  it("fora da biblioteca, usa o título e a banda da API", () => {
    expect(nomeDaMusica({ musica_id: "encore:x", titulo: "Hit", artista: "Banda" }, semBiblioteca)).toBe("Hit — Banda");
    expect(nomeDaMusica({ musica_id: "encore:x", titulo: "Hit", artista: null }, semBiblioteca)).toBe("Hit");
  });

  it("sem nada, mostra o id", () => {
    expect(nomeDaMusica({ musica_id: "encore:x", titulo: "" }, semBiblioteca)).toBe("encore:x");
  });
});
