import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TelaDeDocumento } from "./TelaDeDocumento";

describe("TelaDeDocumento", () => {
  it("mostra o título, as seções e o que vier junto", () => {
    render(
      <TelaDeDocumento documento="privacidade" aoVoltar={vi.fn()}>
        <button>extra</button>
      </TelaDeDocumento>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Política de Privacidade" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(3);
    expect(screen.getByRole("button", { name: "extra" })).toBeInTheDocument();
  });

  it("Voltar e Esc saem da tela", async () => {
    const aoVoltar = vi.fn();
    const usuario = userEvent.setup();
    render(<TelaDeDocumento documento="termos" aoVoltar={aoVoltar} />);
    await usuario.click(screen.getByRole("button", { name: "Voltar" }));
    await usuario.keyboard("{Escape}");
    expect(aoVoltar).toHaveBeenCalledTimes(2);
  });
});
