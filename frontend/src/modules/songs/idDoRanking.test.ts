import { MUSICAS_DE_TESTE } from "@/test/musicas";
import { idDoRanking } from "./idDoRanking";

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
