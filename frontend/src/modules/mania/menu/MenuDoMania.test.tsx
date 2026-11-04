import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuDoMania } from "./MenuDoMania";

function abrir() {
  const acoes = { aoJogar: vi.fn(), aoBuscar: vi.fn(), aoConfigurar: vi.fn() };
  render(<MenuDoMania {...acoes} alavanca={<button type="button">alavanca</button>} />);
  return { ...acoes, usuario: userEvent.setup() };
}

describe("MenuDoMania", () => {
  it("mostra a logo do Mania com a alavanca embaixo, como no Rock", () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Riff Rush Mania" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "alavanca" })).toBeInTheDocument();
  });

  it("cada opção leva à sua tela", async () => {
    const { usuario, aoJogar, aoBuscar, aoConfigurar } = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await usuario.click(screen.getByRole("button", { name: "Buscar mapas" }));
    await usuario.click(screen.getByRole("button", { name: "Configurações" }));
    expect(aoJogar).toHaveBeenCalledOnce();
    expect(aoBuscar).toHaveBeenCalledOnce();
    expect(aoConfigurar).toHaveBeenCalledOnce();
  });

  it("anda pelas opções com as setas e escolhe com o Enter", async () => {
    const { usuario, aoBuscar } = abrir();
    expect(screen.getByRole("button", { name: "Jogar" })).toHaveAttribute("aria-current", "true");
    await usuario.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Buscar mapas" })).toHaveAttribute("aria-current", "true");
    await usuario.keyboard("{Enter}");
    expect(aoBuscar).toHaveBeenCalledOnce();
  });

  it("os ícones são círculos de acerto do osu!, em rosa e branco", () => {
    const { container } = render(<MenuDoMania aoJogar={() => {}} aoBuscar={() => {}} aoConfigurar={() => {}} />);
    expect(container.querySelectorAll("nav [data-parte='circulo']")).toHaveLength(3);
  });
});
