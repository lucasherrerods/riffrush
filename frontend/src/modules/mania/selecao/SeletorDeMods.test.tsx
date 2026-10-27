import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MODS } from "../gameplay/mods";
import { SeletorDeMods, alternarMod } from "./SeletorDeMods";

describe("alternarMod", () => {
  it("liga e desliga", () => {
    expect(alternarMod(0, "HR")).toBe(MODS.HR);
    expect(alternarMod(MODS.HR, "HR")).toBe(0);
  });

  it("ligar um mod desliga os que conflitam com ele", () => {
    expect(alternarMod(MODS.HR | MODS.DT, "EZ")).toBe(MODS.EZ | MODS.DT);
    expect(alternarMod(MODS.DT, "HT")).toBe(MODS.HT);
    expect(alternarMod(MODS.SD, "PF")).toBe(MODS.PF);
    expect(alternarMod(MODS.NF, "SD")).toBe(MODS.SD);
  });
});

it("os botões mostram o que está ligado", async () => {
  const aoMudar = vi.fn();
  render(<SeletorDeMods mods={MODS.HR} aoMudar={aoMudar} />);
  expect(screen.getByRole("button", { name: "HR" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(screen.getByRole("button", { name: "DT" }));
  expect(aoMudar).toHaveBeenCalledWith(MODS.HR | MODS.DT);
});
