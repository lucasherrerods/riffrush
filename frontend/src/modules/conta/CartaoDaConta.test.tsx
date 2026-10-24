import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartaoDaConta } from "./CartaoDaConta";
import { sessaoDaConta } from "./sessao";

const conta = { id: "1", nome: "Lucas", avatar: null, xp_total: 0, nivel: { nivel: 3, xp_no_nivel: 10, xp_para_o_proximo: 100 } };

describe("CartaoDaConta", () => {
  afterEach(() => vi.restoreAllMocks());

  it("mostra nome e nível num botão que abre o menu com a opção de sair", async () => {
    vi.spyOn(sessaoDaConta, "estado").mockReturnValue({ conta, carregando: false });
    const sair = vi.spyOn(sessaoDaConta, "sair").mockResolvedValue();
    const usuario = userEvent.setup();
    render(<CartaoDaConta />);

    expect(screen.getByText("Lucas")).toBeInTheDocument();
    expect(screen.getByText("Nv 3")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /Lucas/ }));
    await usuario.click(screen.getByRole("menuitem", { name: "Sair da conta" }));
    expect(sair).toHaveBeenCalled();
  });
});
