import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TelaDeCustomizacao } from "./TelaDeCustomizacao";

beforeEach(() => localStorage.clear());

function abrir() {
  const aoMudar = vi.fn();
  const aoVoltar = vi.fn();
  render(<TelaDeCustomizacao skinDaPista="classica" skinDaCacapa="classica" aoMudar={aoMudar} aoVoltar={aoVoltar} />);
  return { aoMudar, aoVoltar, usuario: userEvent.setup() };
}

it("a pista e as caçapas são escolhidas em abas separadas", async () => {
  const { aoMudar, usuario } = abrir();
  await usuario.click(screen.getByRole("radio", { name: "Brasa" }));
  expect(aoMudar).toHaveBeenLastCalledWith({ skinDaPista: "brasa" });
  await usuario.click(screen.getByRole("tab", { name: /Caçapas/ }));
  await usuario.click(screen.getByRole("radio", { name: "Colmeia" }));
  expect(aoMudar).toHaveBeenLastCalledWith({ skinDaCacapa: "colmeia" });
});

it("o botão de voltar sai da tela", async () => {
  const { aoVoltar, usuario } = abrir();
  await usuario.click(screen.getByRole("button", { name: "Voltar" }));
  expect(aoVoltar).toHaveBeenCalled();
});
