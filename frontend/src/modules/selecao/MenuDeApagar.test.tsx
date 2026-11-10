import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuDeApagar } from "./MenuDeApagar";

function Montado({ aoConfirmar }: { aoConfirmar: () => void }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  return (
    <MenuDeApagar
      nome="Riff"
      rotuloDoItem="Apagar música"
      descricao="Some deste aparelho."
      menuAberto={menuAberto}
      aoMudarMenu={setMenuAberto}
      confirmando={confirmando}
      aoMudarConfirmando={setConfirmando}
      aoConfirmar={aoConfirmar}
    />
  );
}

it("o item do menu abre a confirmação e só o Remover chama aoConfirmar", async () => {
  const aoConfirmar = vi.fn();
  const usuario = userEvent.setup();
  render(<Montado aoConfirmar={aoConfirmar} />);
  await usuario.click(screen.getByRole("button", { name: "Opções de Riff" }));
  await usuario.click(screen.getByRole("menuitem", { name: /Apagar música/ }));
  const modal = screen.getByRole("dialog", { name: /Remover Riff/ });
  expect(aoConfirmar).not.toHaveBeenCalled();
  await usuario.click(within(modal).getByRole("button", { name: "Remover" }));
  expect(aoConfirmar).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("Cancelar fecha sem apagar", async () => {
  const aoConfirmar = vi.fn();
  const usuario = userEvent.setup();
  render(<Montado aoConfirmar={aoConfirmar} />);
  await usuario.click(screen.getByRole("button", { name: "Opções de Riff" }));
  await usuario.click(screen.getByRole("menuitem", { name: /Apagar música/ }));
  await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(aoConfirmar).not.toHaveBeenCalled();
});
