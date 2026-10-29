import { JEITOS_DE_JOGAR } from "@/modules/rock/gameplay";
import { JEITOS } from "./jeitosDeJogar";

const teclas = { verde: "A", vermelho: "S", palheta: "Enter" };

describe("JEITOS", () => {
  it("descreve todos os jeitos de jogar do motor, cada um uma vez", () => {
    expect(JEITOS.map((j) => j.id).sort()).toEqual([...JEITOS_DE_JOGAR].sort());
  });

  it("os exemplos usam as teclas do jogador", () => {
    const palhetada = JEITOS.find((j) => j.id === "palhetada")!.explicacao({ ...teclas, palheta: "Shift Dir" }).join(" ");
    expect(palhetada).toContain("segure A e S e aperte Shift Dir");
  });
});
