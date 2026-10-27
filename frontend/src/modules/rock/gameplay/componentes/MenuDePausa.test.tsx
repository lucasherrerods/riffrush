import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuDePausa } from "./MenuDePausa";

function abrir(props: Partial<React.ComponentProps<typeof MenuDePausa>> = {}) {
  const acoes = { aoContinuar: vi.fn(), aoRecomecar: vi.fn(), aoSair: vi.fn(), aoDesistir: vi.fn() };
  render(<MenuDePausa derrota={false} emRede={false} {...acoes} {...props} />);
  return { ...acoes, usuario: userEvent.setup() };
}

describe("MenuDePausa", () => {
  it("assistindo ao vivo, sair só para de assistir, sem desistir nem ver placar", async () => {
    const { aoSair, aoDesistir, usuario } = abrir({ emRede: true, aoVivo: true });
    expect(screen.queryByRole("button", { name: /Desistir/ })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /Parar de assistir/ }));
    expect(aoSair).toHaveBeenCalled();
    expect(aoDesistir).not.toHaveBeenCalled();
  });

  it("numa sala, sair é desistir e ver o placar", async () => {
    const { aoDesistir, usuario } = abrir({ emRede: true });
    await usuario.click(screen.getByRole("button", { name: /Desistir e ver placar/ }));
    expect(aoDesistir).toHaveBeenCalled();
  });
});
