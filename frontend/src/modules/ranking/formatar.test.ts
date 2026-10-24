import { haQuantoTempo, precisaoDaPartida } from "./formatar";

describe("haQuantoTempo", () => {
  const agora = new Date("2026-10-24T12:00:00Z");

  it.each([
    ["2026-10-24T11:59:30Z", "agora"],
    ["2026-10-24T11:15:00Z", "há 45 min"],
    ["2026-10-24T07:00:00Z", "há 5 h"],
    ["2026-10-21T12:00:00Z", "há 3 d"],
    ["2026-07-20T12:00:00Z", "há 3 meses"],
    ["2024-10-01T12:00:00Z", "há 2 anos"],
  ])("%s vira %s", (data, texto) => {
    expect(haQuantoTempo(data, agora)).toBe(texto);
  });

  it("um mês só fica no singular", () => {
    expect(haQuantoTempo("2026-09-20T12:00:00Z", agora)).toBe("há 1 mês");
  });
});

describe("precisaoDaPartida", () => {
  it("mostra a porcentagem com duas casas, como no osu!", () => {
    expect(precisaoDaPartida(9946, 10000)).toBe("99,46%");
    expect(precisaoDaPartida(0, 0)).toBe("0,00%");
  });
});
