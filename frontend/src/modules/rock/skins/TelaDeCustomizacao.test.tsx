import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TelaDeCustomizacao } from "./TelaDeCustomizacao";

beforeEach(() => localStorage.clear());

function abrir() {
  const aoMudar = vi.fn();
  const aoVoltar = vi.fn();
  render(<TelaDeCustomizacao valores={{ skinDaPista: "classica", formatoDaCacapa: "redonda", coresDaCacapa: "classica", brilhoDaCacapa: 1, contornoForte: false }} aoMudar={aoMudar} aoVoltar={aoVoltar} />);
  return { aoMudar, aoVoltar, usuario: userEvent.setup() };
}

it("a pista, o formato e as cores são escolhidos em abas separadas", async () => {
  const { aoMudar, usuario } = abrir();
  await usuario.click(screen.getByRole("radio", { name: "Brasa" }));
  expect(aoMudar).toHaveBeenLastCalledWith({ skinDaPista: "brasa" });
  await usuario.click(screen.getByRole("tab", { name: /Formato/ }));
  await usuario.click(screen.getByRole("radio", { name: "Hexagonal" }));
  expect(aoMudar).toHaveBeenLastCalledWith({ formatoDaCacapa: "hexagonal" });
  await usuario.click(screen.getByRole("tab", { name: /Cores/ }));
  await usuario.click(screen.getByRole("radio", { name: "Pastel" }));
  expect(aoMudar).toHaveBeenLastCalledWith({ coresDaCacapa: "pastel" });
});

it("o botão de voltar sai da tela", async () => {
  const { aoVoltar, usuario } = abrir();
  await usuario.click(screen.getByRole("button", { name: "Voltar" }));
  expect(aoVoltar).toHaveBeenCalled();
});
