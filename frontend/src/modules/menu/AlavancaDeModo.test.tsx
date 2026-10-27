import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlavancaDeModo } from "./AlavancaDeModo";

it("é um switch que diz o modo e gira para o outro ao clicar", async () => {
  const aoTrocar = vi.fn();
  render(<AlavancaDeModo modo="rock" aoTrocar={aoTrocar} />);
  const alavanca = screen.getByRole("switch", { name: "Modo de jogo: Rock" });
  expect(alavanca).toHaveAttribute("aria-checked", "false");
  await userEvent.click(alavanca);
  expect(aoTrocar).toHaveBeenCalledWith("mania");
});

it("pelo teclado, as setas escolhem o lado e o Enter gira", async () => {
  const aoTrocar = vi.fn();
  render(<AlavancaDeModo modo="mania" aoTrocar={aoTrocar} />);
  const alavanca = screen.getByRole("switch", { name: "Modo de jogo: Mania" });
  fireEvent.keyDown(alavanca, { key: "ArrowRight" });
  expect(aoTrocar).not.toHaveBeenCalled();
  fireEvent.keyDown(alavanca, { key: "ArrowLeft" });
  expect(aoTrocar).toHaveBeenCalledWith("rock");
  alavanca.focus();
  await userEvent.keyboard("{Enter}");
  expect(aoTrocar).toHaveBeenLastCalledWith("rock");
});
